import type { ReactionInput } from "@hivetalk/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { toMessageDto } from "../lib/serialize.js";
import { assertChannelMember } from "./membership.js";

const messageInclude = {
  author: { select: { id: true, displayName: true } },
  reactions: { select: { emoji: true, userId: true } },
  attachments: true,
  _count: { select: { replies: true } },
} as const;

async function loadMessageDto(messageId: string, userId: string) {
  const message = await prisma.message.findUniqueOrThrow({
    where: { id: messageId },
    include: messageInclude,
  });
  return toMessageDto(message, userId);
}

export async function addReaction(userId: string, input: ReactionInput) {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
  });
  if (!message) throw new AppError(404, "Message not found");

  await assertChannelMember(userId, message.channelId);

  await prisma.reaction.upsert({
    where: {
      messageId_userId_emoji: {
        messageId: input.messageId,
        userId,
        emoji: input.emoji,
      },
    },
    create: {
      messageId: input.messageId,
      userId,
      emoji: input.emoji,
    },
    update: {},
  });

  return {
    channelId: message.channelId,
    message: await loadMessageDto(input.messageId, userId),
  };
}

export async function removeReaction(userId: string, input: ReactionInput) {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
  });
  if (!message) throw new AppError(404, "Message not found");

  await assertChannelMember(userId, message.channelId);

  await prisma.reaction.deleteMany({
    where: {
      messageId: input.messageId,
      userId,
      emoji: input.emoji,
    },
  });

  return {
    channelId: message.channelId,
    message: await loadMessageDto(input.messageId, userId),
  };
}
