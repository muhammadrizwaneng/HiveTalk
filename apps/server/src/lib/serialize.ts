import type { User } from "@prisma/client";
import type {
  AttachmentDto,
  MessageDto,
  PublicUser,
  ReactionSummary,
} from "@hivetalk/shared";

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    statusText: user.statusText ?? "",
    statusEmoji: user.statusEmoji ?? "",
    createdAt: user.createdAt.toISOString(),
  };
}

function toReactionSummaries(
  reactions: { emoji: string; userId: string }[],
  currentUserId?: string,
): ReactionSummary[] {
  const map = new Map<string, { count: number; userIds: string[]; me: boolean }>();
  for (const r of reactions) {
    const entry = map.get(r.emoji) ?? { count: 0, userIds: [], me: false };
    entry.count += 1;
    entry.userIds.push(r.userId);
    if (currentUserId && r.userId === currentUserId) entry.me = true;
    map.set(r.emoji, entry);
  }
  return [...map.entries()].map(([emoji, v]) => ({
    emoji,
    count: v.count,
    me: v.me,
    userIds: v.userIds,
  }));
}

export function toAttachmentDto(attachment: {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}): AttachmentDto {
  return {
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: `/api/attachments/${attachment.id}`,
  };
}

export function toMessageDto(
  message: {
    id: string;
    channelId: string;
    authorId: string;
    content: string;
    kind?: MessageDto["kind"];
    parentId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    author?: { id: string; displayName: string };
    reactions?: { emoji: string; userId: string }[];
    attachments?: {
      id: string;
      filename: string;
      mimeType: string;
      size: number;
    }[];
    _count?: { replies?: number };
  },
  currentUserId?: string,
): MessageDto {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.authorId,
    content: message.content,
    kind: message.kind ?? "NORMAL",
    parentId: message.parentId ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    author: message.author
      ? { id: message.author.id, displayName: message.author.displayName }
      : undefined,
    replyCount: message._count?.replies ?? 0,
    reactions: message.reactions
      ? toReactionSummaries(message.reactions, currentUserId)
      : [],
    attachments: message.attachments?.map(toAttachmentDto) ?? [],
  };
}
