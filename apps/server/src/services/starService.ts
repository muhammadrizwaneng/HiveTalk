import { prisma } from "../lib/prisma.js";
import { assertChannelMember } from "./membership.js";

export async function starChannel(userId: string, channelId: string) {
  await assertChannelMember(userId, channelId);
  await prisma.starredChannel.upsert({
    where: { userId_channelId: { userId, channelId } },
    create: { userId, channelId },
    update: {},
  });
}

export async function unstarChannel(userId: string, channelId: string) {
  await assertChannelMember(userId, channelId);
  await prisma.starredChannel.deleteMany({
    where: { userId, channelId },
  });
}

export async function getStarredChannelIds(userId: string, channelIds: string[]) {
  if (channelIds.length === 0) return new Set<string>();
  const stars = await prisma.starredChannel.findMany({
    where: { userId, channelId: { in: channelIds } },
    select: { channelId: true },
  });
  return new Set(stars.map((s) => s.channelId));
}
