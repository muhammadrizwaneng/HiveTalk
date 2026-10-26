import { z } from "zod";
import { LIMITS, REACTION_EMOJIS, ROLES } from "./constants.js";

export const registerSchema = z.object({
  email: z.string().trim().email().max(LIMITS.EMAIL_MAX),
  password: z
    .string()
    .min(LIMITS.PASSWORD_MIN)
    .max(LIMITS.PASSWORD_MAX),
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(LIMITS.DISPLAY_NAME_MAX),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(LIMITS.EMAIL_MAX),
  password: z.string().min(1).max(LIMITS.PASSWORD_MAX),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.WORKSPACE_NAME_MAX),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, hyphens")
    .optional(),
});

export const createChannelSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z
    .string()
    .trim()
    .min(1)
    .max(LIMITS.CHANNEL_NAME_MAX)
    .regex(
      /^[a-z0-9-_]+$/,
      "Channel name must be lowercase alphanumeric, hyphens, or underscores",
    ),
  isPrivate: z.boolean().optional().default(false),
  department: z
    .enum(["GENERAL", "ENGINEERING", "HR", "SOCIAL"])
    .optional()
    .default("GENERAL"),
  memberIds: z.array(z.string().cuid()).max(50).optional(),
});

export const seedDepartmentSchema = z.object({
  department: z.enum(["ENGINEERING", "HR", "SOCIAL"]),
});

export const saveDraftSchema = z.object({
  channelId: z.string().cuid(),
  content: z.string().max(LIMITS.MESSAGE_CONTENT_MAX),
});

export const addWorkspaceMemberSchema = z.object({
  email: z.string().trim().email().max(LIMITS.EMAIL_MAX),
});

export const addChannelMembersSchema = z.object({
  channelId: z.string().cuid(),
  memberIds: z.array(z.string().cuid()).min(1).max(50),
});

export const openDmSchema = z.object({
  userId: z.string().cuid(),
});

export const sendMessageSchema = z.object({
  channelId: z.string().cuid(),
  content: z.string().trim().min(1).max(LIMITS.MESSAGE_CONTENT_MAX),
  parentId: z.string().cuid().optional(),
  attachmentIds: z.array(z.string().cuid()).max(5).optional(),
  kind: z
    .enum([
      "NORMAL",
      "ANNOUNCEMENT",
      "PTO_REQUEST",
      "BUG_REPORT",
      "CODE_SNIPPET",
      "CAMPAIGN_DRAFT",
      "CONTENT_APPROVAL",
    ])
    .optional(),
});

export const updateMessageSchema = z.object({
  messageId: z.string().cuid(),
  content: z.string().trim().min(1).max(LIMITS.MESSAGE_CONTENT_MAX),
});

export const deleteMessageSchema = z.object({
  messageId: z.string().cuid(),
});

export const channelJoinSchema = z.object({
  channelId: z.string().cuid(),
});

export const typingSchema = z.object({
  channelId: z.string().cuid(),
});

export const reactionSchema = z.object({
  messageId: z.string().cuid(),
  emoji: z
    .string()
    .min(1)
    .max(LIMITS.EMOJI_MAX)
    .refine(
      (v) => (REACTION_EMOJIS as readonly string[]).includes(v),
      "Unsupported emoji",
    ),
});

export const markReadSchema = z.object({
  channelId: z.string().cuid(),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(LIMITS.SEARCH_QUERY_MAX),
});

export const updateChannelTopicSchema = z.object({
  topic: z.string().trim().max(LIMITS.CHANNEL_TOPIC_MAX),
});

export const updateStatusSchema = z.object({
  statusText: z.string().trim().max(LIMITS.STATUS_TEXT_MAX),
  statusEmoji: z.string().trim().max(LIMITS.STATUS_EMOJI_MAX),
});

export const pinMessageSchema = z.object({
  messageId: z.string().cuid(),
});

export const starChannelSchema = z.object({
  channelId: z.string().cuid(),
});

export const roleSchema = z.enum([ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER]);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type SeedDepartmentInput = z.infer<typeof seedDepartmentSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type AddChannelMembersInput = z.infer<typeof addChannelMembersSchema>;
export type OpenDmInput = z.infer<typeof openDmSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;
export type ChannelJoinInput = z.infer<typeof channelJoinSchema>;
export type TypingInput = z.infer<typeof typingSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type UpdateChannelTopicInput = z.infer<typeof updateChannelTopicSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type PinMessageInput = z.infer<typeof pinMessageSchema>;
export type StarChannelInput = z.infer<typeof starChannelSchema>;
