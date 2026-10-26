import { prisma } from "../lib/prisma.js";
import { assertChannelMember } from "./membership.js";

export async function saveDraft(
  userId: string,
  channelId: string,
  content: string,
) {
  await assertChannelMember(userId, channelId);
  if (!content.trim()) {
    await prisma.messageDraft.deleteMany({ where: { userId, channelId } });
    return { channelId, content: "" };
  }
  const draft = await prisma.messageDraft.upsert({
    where: { userId_channelId: { userId, channelId } },
    create: { userId, channelId, content },
    update: { content },
  });
  return { channelId: draft.channelId, content: draft.content };
}

export async function getDraft(userId: string, channelId: string) {
  await assertChannelMember(userId, channelId);
  const draft = await prisma.messageDraft.findUnique({
    where: { userId_channelId: { userId, channelId } },
  });
  return { channelId, content: draft?.content ?? "" };
}
