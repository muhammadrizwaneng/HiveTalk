import type { SendMessageInput, UpdateMessageInput } from "@hivetalk/shared";
import { parseSlashCommand } from "@hivetalk/shared";
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

export async function listMessages(
  userId: string,
  channelId: string,
  limit = 50,
) {
  await assertChannelMember(userId, channelId);

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const messages = await prisma.message.findMany({
    where: { channelId, parentId: null },
    include: messageInclude,
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  return messages.reverse().map((m) => toMessageDto(m, userId));
}

export async function listThreadReplies(userId: string, parentId: string) {
  const parent = await prisma.message.findUnique({
    where: { id: parentId },
    include: messageInclude,
  });

  if (!parent) {
    throw new AppError(404, "Message not found");
  }

  await assertChannelMember(userId, parent.channelId);

  const replies = await prisma.message.findMany({
    where: { parentId },
    include: messageInclude,
    orderBy: { createdAt: "asc" },
  });

  return {
    parent: toMessageDto(parent, userId),
    replies: replies.map((m) => toMessageDto(m, userId)),
  };
}

export async function createMessage(userId: string, input: SendMessageInput) {
  await assertChannelMember(userId, input.channelId);

  if (input.parentId) {
    const parent = await prisma.message.findUnique({
      where: { id: input.parentId },
    });
    if (!parent || parent.channelId !== input.channelId) {
      throw new AppError(400, "Invalid thread parent");
    }
    if (parent.parentId) {
      throw new AppError(400, "Cannot reply to a thread reply");
    }
  }

  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 0) {
    const owned = await prisma.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        uploaderId: userId,
        messageId: null,
      },
    });
    if (owned.length !== attachmentIds.length) {
      throw new AppError(400, "Invalid or already used attachments");
    }
  }

  const parsed = parseSlashCommand(input.content);
  const content = parsed?.content ?? input.content;
  const kind = input.kind ?? parsed?.kind ?? "NORMAL";

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        channelId: input.channelId,
        authorId: userId,
        content,
        kind,
        parentId: input.parentId,
      },
    });

    await tx.messageDraft.deleteMany({
      where: { userId, channelId: input.channelId },
    });

    if (attachmentIds.length > 0) {
      await tx.attachment.updateMany({
        where: {
          id: { in: attachmentIds },
          uploaderId: userId,
          messageId: null,
        },
        data: { messageId: created.id },
      });
    }

    await tx.channel.update({
      where: { id: input.channelId },
      data: { updatedAt: new Date() },
    });

    return tx.message.findUniqueOrThrow({
      where: { id: created.id },
      include: messageInclude,
    });
  });

  return toMessageDto(message, userId);
}

export async function updateMessage(userId: string, input: UpdateMessageInput) {
  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
  });

  if (!message) {
    throw new AppError(404, "Message not found");
  }

  await assertChannelMember(userId, message.channelId);

  if (message.authorId !== userId) {
    throw new AppError(403, "You can only edit your own messages");
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { content: input.content },
    include: messageInclude,
  });

  return toMessageDto(updated, userId);
}

export async function deleteMessage(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new AppError(404, "Message not found");
  }

  await assertChannelMember(userId, message.channelId);

  if (message.authorId !== userId) {
    throw new AppError(403, "You can only delete your own messages");
  }

  await prisma.message.delete({ where: { id: messageId } });

  return {
    messageId: message.id,
    channelId: message.channelId,
    parentId: message.parentId,
  };
}
