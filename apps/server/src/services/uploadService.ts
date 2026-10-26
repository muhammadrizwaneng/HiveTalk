import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { LIMITS } from "@hivetalk/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { toAttachmentDto } from "../lib/serialize.js";
import { assertChannelMember } from "./membership.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveUpload(
  userId: string,
  file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  },
) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new AppError(400, "File type not allowed");
  }
  if (file.size <= 0 || file.size > LIMITS.ATTACHMENT_MAX_BYTES) {
    throw new AppError(400, "File too large (max 5MB)");
  }

  await ensureUploadDir();
  const ext = path.extname(file.originalname).slice(0, 16);
  const storageKey = `${randomUUID()}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, storageKey);
  await fs.writeFile(fullPath, file.buffer);

  const attachment = await prisma.attachment.create({
    data: {
      uploaderId: userId,
      filename: file.originalname.slice(0, 200),
      mimeType: file.mimetype,
      size: file.size,
      storageKey,
      messageId: null,
    },
  });

  return toAttachmentDto(attachment);
}

export async function getAttachmentForDownload(
  userId: string,
  attachmentId: string,
) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment) throw new AppError(404, "Attachment not found");

  if (attachment.messageId) {
    const message = await prisma.message.findUnique({
      where: { id: attachment.messageId },
    });
    if (!message) throw new AppError(404, "Attachment not found");
    await assertChannelMember(userId, message.channelId);
  } else if (attachment.uploaderId !== userId) {
    throw new AppError(403, "Not allowed to access this file");
  }

  const fullPath = path.join(UPLOAD_DIR, attachment.storageKey);
  return { attachment, fullPath };
}

export { UPLOAD_DIR };
