export const SOCKET_EVENTS = {
  MESSAGE_CREATE: "message:create",
  MESSAGE_CREATED: "message:created",
  MESSAGE_UPDATE: "message:update",
  MESSAGE_UPDATED: "message:updated",
  MESSAGE_DELETE: "message:delete",
  MESSAGE_DELETED: "message:deleted",
  REACTION_ADD: "reaction:add",
  REACTION_REMOVE: "reaction:remove",
  REACTION_CHANGED: "reaction:changed",
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  CHANNEL_JOIN: "channel:join",
  CHANNEL_LEAVE: "channel:leave",
  WORKSPACE_JOIN: "workspace:join",
  PRESENCE_UPDATE: "presence:update",
  MESSAGE_PIN: "message:pin",
  MESSAGE_UNPIN: "message:unpin",
  PINS_CHANGED: "pins:changed",
  STATUS_CHANGED: "status:changed",
  ERROR: "error",
} as const;

export const ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export const LIMITS = {
  DISPLAY_NAME_MAX: 80,
  EMAIL_MAX: 255,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  CHANNEL_NAME_MAX: 80,
  MESSAGE_CONTENT_MAX: 4000,
  WORKSPACE_NAME_MAX: 80,
  EMOJI_MAX: 32,
  ATTACHMENT_MAX_BYTES: 5 * 1024 * 1024,
  SEARCH_QUERY_MAX: 100,
  CHANNEL_TOPIC_MAX: 250,
  STATUS_TEXT_MAX: 100,
  STATUS_EMOJI_MAX: 16,
} as const;

export const AUTH_COOKIE_NAME = "hivetalk_token";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🔥"] as const;
