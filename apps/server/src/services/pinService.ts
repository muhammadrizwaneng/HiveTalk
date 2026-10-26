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

export async function listPins(userId: string, channelId: string) {
  await assertChannelMember(userId, channelId);

  const pins = await prisma.pinnedMessage.findMany({
    where: { channelId },
    include: {
      message: { include: messageInclude },
    },
    orderBy: { createdAt: "desc" },
  });

  return pins.map((p) => ({
    ...toMessageDto(p.message, userId),
    pinned: true,
  }));
}

export async function pinMessage(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });
  if (!message) throw new AppError(404, "Message not found");
  if (message.parentId) {
    throw new AppError(400, "Cannot pin thread replies");
  }

  await assertChannelMember(userId, message.channelId);

  await prisma.pinnedMessage.upsert({
    where: {
      channelId_messageId: {
        channelId: message.channelId,
        messageId: message.id,
      },
    },
    create: {
      channelId: message.channelId,
      messageId: message.id,
      pinnedById: userId,
    },
    update: {},
  });

  const pins = await listPins(userId, message.channelId);
  return { channelId: message.channelId, pins };
}

export async function unpinMessage(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });
  if (!message) throw new AppError(404, "Message not found");

  await assertChannelMember(userId, message.channelId);

  await prisma.pinnedMessage.deleteMany({
    where: { channelId: message.channelId, messageId },
  });

  const pins = await listPins(userId, message.channelId);
  return { channelId: message.channelId, pins };
}
