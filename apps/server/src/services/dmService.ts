import type { OpenDmInput } from "@hivetalk/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { toPublicUser } from "../lib/serialize.js";
import { assertWorkspaceMember } from "./membership.js";

function dmPairKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":");
}

function toDmSummary(
  channel: {
    id: string;
    workspaceId: string;
    name: string;
    createdAt: Date;
    participants: { user: Parameters<typeof toPublicUser>[0] }[];
  },
  currentUserId: string,
) {
  const peer = channel.participants.find((p) => p.user.id !== currentUserId)?.user;
  if (!peer) {
    throw new AppError(500, "DM peer not found");
  }

  return {
    id: channel.id,
    workspaceId: channel.workspaceId,
    name: channel.name,
    type: "DM" as const,
    createdAt: channel.createdAt.toISOString(),
    peer: {
      id: peer.id,
      email: peer.email,
      displayName: peer.displayName,
      createdAt: peer.createdAt.toISOString(),
    },
  };
}

export async function listDirectMessages(userId: string, workspaceId: string) {
  await assertWorkspaceMember(userId, workspaceId);

  const channels = await prisma.channel.findMany({
    where: {
      workspaceId,
      type: "DM",
      participants: { some: { userId } },
    },
    include: {
      participants: { include: { user: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const { getUnreadCounts } = await import("./readStateService.js");
  const { getStarredChannelIds } = await import("./starService.js");
  const ids = channels.map((c) => c.id);
  const [unread, starred] = await Promise.all([
    getUnreadCounts(userId, ids),
    getStarredChannelIds(userId, ids),
  ]);

  return channels.map((c) => ({
    ...toDmSummary(c, userId),
    unreadCount: unread[c.id] ?? 0,
    starred: starred.has(c.id),
  }));
}

export async function openOrCreateDirectMessage(
  userId: string,
  workspaceId: string,
  input: OpenDmInput,
) {
  await assertWorkspaceMember(userId, workspaceId);

  if (input.userId === userId) {
    throw new AppError(400, "Cannot start a DM with yourself");
  }

  await assertWorkspaceMember(input.userId, workspaceId);

  const pairKey = dmPairKey(userId, input.userId);

  const existing = await prisma.channel.findUnique({
    where: {
      workspaceId_dmPairKey: {
        workspaceId,
        dmPairKey: pairKey,
      },
    },
    include: {
      participants: { include: { user: true } },
    },
  });

  if (existing) {
    return toDmSummary(existing, userId);
  }

  const channel = await prisma.channel.create({
    data: {
      workspaceId,
      type: "DM",
      name: `dm-${pairKey}`,
      dmPairKey: pairKey,
      participants: {
        create: [{ userId }, { userId: input.userId }],
      },
    },
    include: {
      participants: { include: { user: true } },
    },
  });

  return toDmSummary(channel, userId);
}
