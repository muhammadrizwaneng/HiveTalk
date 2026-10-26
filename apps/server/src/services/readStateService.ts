import { prisma } from "../lib/prisma.js";
import { assertChannelMember } from "./membership.js";

export async function markChannelRead(userId: string, channelId: string) {
  await assertChannelMember(userId, channelId);

  return prisma.channelReadState.upsert({
    where: {
      userId_channelId: { userId, channelId },
    },
    create: {
      userId,
      channelId,
      lastReadAt: new Date(),
    },
    update: {
      lastReadAt: new Date(),
    },
  });
}

export async function getUnreadCounts(
  userId: string,
  channelIds: string[],
): Promise<Record<string, number>> {
  if (channelIds.length === 0) return {};

  const readStates = await prisma.channelReadState.findMany({
    where: { userId, channelId: { in: channelIds } },
  });
  const lastReadMap = new Map(
    readStates.map((r) => [r.channelId, r.lastReadAt] as const),
  );

  const counts: Record<string, number> = {};
  await Promise.all(
    channelIds.map(async (channelId) => {
      const lastRead = lastReadMap.get(channelId) ?? new Date(0);
      const count = await prisma.message.count({
        where: {
          channelId,
          parentId: null,
          createdAt: { gt: lastRead },
          NOT: { authorId: userId },
        },
      });
      counts[channelId] = count;
    }),
  );

  return counts;
}
