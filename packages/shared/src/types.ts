import type { ROLES } from "./constants.js";
import type { Department, MessageKind } from "./teams.js";

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type ChannelType = "CHANNEL" | "DM";

export type { Department, MessageKind };

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  statusText?: string;
  statusEmoji?: string;
  createdAt: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  /** URL key, e.g. seebiz → /w/seebiz · display host hivetalk.seebiz */
  slug: string;
  createdAt: string;
}

export interface ChannelSummary {
  id: string;
  workspaceId: string;
  name: string;
  topic?: string;
  type?: ChannelType;
  isPrivate?: boolean;
  department?: Department;
  createdAt: string;
  unreadCount?: number;
  starred?: boolean;
}

export interface DmSummary {
  id: string;
  workspaceId: string;
  name: string;
  type: "DM";
  createdAt: string;
  peer: PublicUser;
  unreadCount?: number;
  starred?: boolean;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  me: boolean;
  userIds: string[];
}

export interface AttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface MessageDto {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  kind?: MessageKind;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: Pick<PublicUser, "id" | "displayName">;
  replyCount?: number;
  reactions?: ReactionSummary[];
  attachments?: AttachmentDto[];
  pinned?: boolean;
  mentionsMe?: boolean;
}

export interface ActivityItem {
  id: string;
  type: "mention" | "dm" | "thread" | "announcement" | "approval";
  channelId: string;
  channelName: string;
  message: MessageDto;
  createdAt: string;
}

export interface SearchHit {
  message: MessageDto;
  channelId: string;
  channelName: string;
  channelType: ChannelType;
}

export interface AuthResponse {
  user: PublicUser;
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

export interface SocketErrorPayload {
  event?: string;
  message: string;
}

export interface PresencePayload {
  workspaceId: string;
  onlineUserIds: string[];
}
