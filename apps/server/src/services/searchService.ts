import type { ChannelType } from "@hivetalk/shared";
import { prisma } from "../lib/prisma.js";
import { toMessageDto } from "../lib/serialize.js";
import { assertWorkspaceMember } from "./membership.js";

interface SearchFilters {
  raw: string;
  from?: string;
  in?: string;
  hasPin?: boolean;
  before?: Date;
  after?: Date;
  text: string;
}

function parseSearchQuery(query: string): SearchFilters {
  let remaining = query.trim();
  const filters: SearchFilters = { raw: query, text: "" };

  const fromMatch = remaining.match(/\bfrom:(\S+)/i);
  if (fromMatch?.[1]) {
    filters.from = fromMatch[1].replace(/^@/, "");
    remaining = remaining.replace(fromMatch[0], " ");
  }

  const inMatch = remaining.match(/\bin:(\S+)/i);
  if (inMatch?.[1]) {
    filters.in = inMatch[1].replace(/^#/, "");
    remaining = remaining.replace(inMatch[0], " ");
  }

  if (/\bhas:pin\b/i.test(remaining)) {
    filters.hasPin = true;
    remaining = remaining.replace(/\bhas:pin\b/i, " ");
  }

  const beforeMatch = remaining.match(/\bbefore:(\d{4}-\d{2}-\d{2})\b/i);
  if (beforeMatch?.[1]) {
    filters.before = new Date(`${beforeMatch[1]}T23:59:59.999Z`);
    remaining = remaining.replace(beforeMatch[0], " ");
  }

  const afterMatch = remaining.match(/\bafter:(\d{4}-\d{2}-\d{2})\b/i);
  if (afterMatch?.[1]) {
    filters.after = new Date(`${afterMatch[1]}T00:00:00.000Z`);
    remaining = remaining.replace(afterMatch[0], " ");
  }

  filters.text = remaining.replace(/\s+/g, " ").trim();
  return filters;
}

export async function searchWorkspaceMessages(
  userId: string,
  workspaceId: string,
  query: string,
) {
  await assertWorkspaceMember(userId, workspaceId);
  const filters = parseSearchQuery(query);

  const membershipChannels = await prisma.channel.findMany({
    where: {
      workspaceId,
      OR: [
        { type: "CHANNEL", isPrivate: false },
        {
          type: "CHANNEL",
          isPrivate: true,
          participants: { some: { userId } },
        },
        {
          type: "DM",
          participants: { some: { userId } },
        },
      ],
    },
    select: { id: true, name: true, type: true },
  });

  let channels = membershipChannels;
  if (filters.in) {
    const needle = filters.in.toLowerCase();
    channels = channels.filter((c) => c.name.toLowerCase().includes(needle));
  }

  const channelIds = channels.map((c) => c.id);
  if (channelIds.length === 0) return [];

  const channelMap = new Map(channels.map((c) => [c.id, c] as const));

  let authorId: string | undefined;
  if (filters.from) {
    const needle = filters.from.toLowerCase();
    const candidates = await prisma.user.findMany({
      where: { memberships: { some: { workspaceId } } },
      select: { id: true, displayName: true },
    });
    const author = candidates.find(
      (u) => u.displayName.toLowerCase() === needle,
    );
    if (!author) return [];
    authorId = author.id;
  }

  const pinnedIds = filters.hasPin
    ? (
        await prisma.pinnedMessage.findMany({
          where: { channelId: { in: channelIds } },
          select: { messageId: true },
        })
      ).map((p) => p.messageId)
    : undefined;

  if (filters.hasPin && pinnedIds && pinnedIds.length === 0) return [];

  const messages = await prisma.message.findMany({
    where: {
      channelId: { in: channelIds },
      // SQLite: no Prisma `mode: insensitive`; LIKE is case-insensitive for ASCII.
      ...(filters.text ? { content: { contains: filters.text } } : {}),
      ...(authorId ? { authorId } : {}),
      ...(pinnedIds ? { id: { in: pinnedIds } } : {}),
      ...(filters.before || filters.after
        ? {
            createdAt: {
              ...(filters.after ? { gte: filters.after } : {}),
              ...(filters.before ? { lte: filters.before } : {}),
            },
          }
        : {}),
    },
    include: {
      author: { select: { id: true, displayName: true } },
      reactions: { select: { emoji: true, userId: true } },
      attachments: true,
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return messages.map((m) => {
    const channel = channelMap.get(m.channelId)!;
    return {
      message: toMessageDto(m, userId),
      channelId: m.channelId,
      channelName: channel.name,
      channelType: channel.type as ChannelType,
    };
  });
}
