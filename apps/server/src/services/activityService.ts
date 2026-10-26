import type { ActivityItem } from "@hivetalk/shared";
import { prisma } from "../lib/prisma.js";
import { toMessageDto } from "../lib/serialize.js";
import { assertWorkspaceMember } from "./membership.js";

export async function getActivityFeed(
  userId: string,
  workspaceId: string,
): Promise<ActivityItem[]> {
  await assertWorkspaceMember(userId, workspaceId);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const mentionNeedle = `@${user.displayName}`;

  const channels = await prisma.channel.findMany({
    where: {
      workspaceId,
      OR: [
        { type: "CHANNEL", isPrivate: false },
        { type: "CHANNEL", isPrivate: true, participants: { some: { userId } } },
        { type: "DM", participants: { some: { userId } } },
      ],
    },
    select: { id: true, name: true, type: true },
  });
  const channelMap = new Map(channels.map((c) => [c.id, c]));
  const channelIds = channels.map((c) => c.id);
  if (!channelIds.length) return [];

  const messages = await prisma.message.findMany({
    where: {
      channelId: { in: channelIds },
      OR: [
        { content: { contains: mentionNeedle } },
        {
          channel: { type: "DM", participants: { some: { userId } } },
          NOT: { authorId: userId },
        },
        {
          kind: { in: ["ANNOUNCEMENT", "CONTENT_APPROVAL", "PTO_REQUEST"] },
        },
        {
          parentId: { not: null },
          parent: { authorId: userId },
          NOT: { authorId: userId },
        },
      ],
    },
    include: {
      author: { select: { id: true, displayName: true } },
      reactions: { select: { emoji: true, userId: true } },
      attachments: true,
      _count: { select: { replies: true } },
      channel: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return messages.map((m) => {
    const channel = channelMap.get(m.channelId) ?? m.channel;
    let type: ActivityItem["type"] = "mention";
    if (channel.type === "DM") type = "dm";
    else if (m.parentId) type = "thread";
    else if (m.kind === "ANNOUNCEMENT") type = "announcement";
    else if (m.kind === "CONTENT_APPROVAL") type = "approval";
    else if (m.content.includes(mentionNeedle)) type = "mention";

    return {
      id: m.id,
      type,
      channelId: m.channelId,
      channelName: channel.name,
      message: toMessageDto(m, userId),
      createdAt: m.createdAt.toISOString(),
    };
  });
}
