import type { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  channelJoinSchema,
  deleteMessageSchema,
  pinMessageSchema,
  reactionSchema,
  sendMessageSchema,
  typingSchema,
  updateMessageSchema,
} from "@hivetalk/shared";
import { z } from "zod";
import { isAppError } from "../lib/errors.js";
import {
  createMessage,
  deleteMessage,
  updateMessage,
} from "../services/messageService.js";
import { assertChannelMember, assertWorkspaceMember } from "../services/membership.js";
import {
  addPresence,
  getOnlineUserIds,
  removePresence,
} from "../services/presenceService.js";
import { pinMessage, unpinMessage } from "../services/pinService.js";
import { addReaction, removeReaction } from "../services/reactionService.js";
import type { AuthedSocketData } from "./auth.js";

const workspacePresenceSchema = z.object({
  workspaceId: z.string().cuid(),
});

function emitSocketError(socket: Socket, message: string, event?: string) {
  socket.emit(SOCKET_EVENTS.ERROR, { message, event });
}

function getUser(socket: Socket) {
  return (socket.data as AuthedSocketData).user;
}

export function registerSocketHandlers(io: Server, socket: Socket) {
  const user = getUser(socket);

  socket.on("workspace:join", async (payload: unknown) => {
    const parsed = workspacePresenceSchema.safeParse(payload);
    if (!parsed.success) return;
    try {
      await assertWorkspaceMember(user.id, parsed.data.workspaceId);
      await socket.join(`workspace:${parsed.data.workspaceId}`);
      addPresence(parsed.data.workspaceId, user.id, socket.id);
      io.to(`workspace:${parsed.data.workspaceId}`).emit(
        SOCKET_EVENTS.PRESENCE_UPDATE,
        {
          workspaceId: parsed.data.workspaceId,
          onlineUserIds: getOnlineUserIds(parsed.data.workspaceId),
        },
      );
    } catch {
      // ignore
    }
  });

  socket.on("disconnect", () => {
    const touched = removePresence(socket.id);
    for (const workspaceId of touched) {
      io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.PRESENCE_UPDATE, {
        workspaceId,
        onlineUserIds: getOnlineUserIds(workspaceId),
      });
    }
  });

  socket.on(SOCKET_EVENTS.CHANNEL_JOIN, async (payload: unknown) => {
    const parsed = channelJoinSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid channel join payload", SOCKET_EVENTS.CHANNEL_JOIN);
      return;
    }

    try {
      await assertChannelMember(user.id, parsed.data.channelId);
      await socket.join(parsed.data.channelId);
    } catch (error) {
      emitSocketError(
        socket,
        isAppError(error) ? error.message : "Failed to join channel",
        SOCKET_EVENTS.CHANNEL_JOIN,
      );
    }
  });

  socket.on(SOCKET_EVENTS.CHANNEL_LEAVE, async (payload: unknown) => {
    const parsed = channelJoinSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid channel leave payload", SOCKET_EVENTS.CHANNEL_LEAVE);
      return;
    }
    await socket.leave(parsed.data.channelId);
  });

  socket.on(SOCKET_EVENTS.MESSAGE_CREATE, async (payload: unknown) => {
    const parsed = sendMessageSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid message payload", SOCKET_EVENTS.MESSAGE_CREATE);
      return;
    }

    try {
      const message = await createMessage(user.id, parsed.data);
      io.to(parsed.data.channelId).emit(SOCKET_EVENTS.MESSAGE_CREATED, message);
    } catch (error) {
      emitSocketError(
        socket,
        isAppError(error) ? error.message : "Failed to create message",
        SOCKET_EVENTS.MESSAGE_CREATE,
      );
    }
  });

  socket.on(SOCKET_EVENTS.MESSAGE_UPDATE, async (payload: unknown) => {
    const parsed = updateMessageSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid update payload", SOCKET_EVENTS.MESSAGE_UPDATE);
      return;
    }

    try {
      const message = await updateMessage(user.id, parsed.data);
      io.to(message.channelId).emit(SOCKET_EVENTS.MESSAGE_UPDATED, message);
    } catch (error) {
      emitSocketError(
        socket,
        isAppError(error) ? error.message : "Failed to update message",
        SOCKET_EVENTS.MESSAGE_UPDATE,
      );
    }
  });

  socket.on(SOCKET_EVENTS.MESSAGE_DELETE, async (payload: unknown) => {
    const parsed = deleteMessageSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid delete payload", SOCKET_EVENTS.MESSAGE_DELETE);
      return;
    }

    try {
      const result = await deleteMessage(user.id, parsed.data.messageId);
      io.to(result.channelId).emit(SOCKET_EVENTS.MESSAGE_DELETED, result);
    } catch (error) {
      emitSocketError(
        socket,
        isAppError(error) ? error.message : "Failed to delete message",
        SOCKET_EVENTS.MESSAGE_DELETE,
      );
    }
  });

  socket.on(SOCKET_EVENTS.REACTION_ADD, async (payload: unknown) => {
    const parsed = reactionSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid reaction payload", SOCKET_EVENTS.REACTION_ADD);
      return;
    }
    try {
      const result = await addReaction(user.id, parsed.data);
      io.to(result.channelId).emit(SOCKET_EVENTS.REACTION_CHANGED, result.message);
    } catch (error) {
      emitSocketError(
        socket,
        isAppError(error) ? error.message : "Failed to add reaction",
        SOCKET_EVENTS.REACTION_ADD,
      );
    }
  });

  socket.on(SOCKET_EVENTS.REACTION_REMOVE, async (payload: unknown) => {
    const parsed = reactionSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid reaction payload", SOCKET_EVENTS.REACTION_REMOVE);
      return;
    }
    try {
      const result = await removeReaction(user.id, parsed.data);
      io.to(result.channelId).emit(SOCKET_EVENTS.REACTION_CHANGED, result.message);
    } catch (error) {
      emitSocketError(
        socket,
        isAppError(error) ? error.message : "Failed to remove reaction",
        SOCKET_EVENTS.REACTION_REMOVE,
      );
    }
  });

  socket.on(SOCKET_EVENTS.MESSAGE_PIN, async (payload: unknown) => {
    const parsed = pinMessageSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid pin payload", SOCKET_EVENTS.MESSAGE_PIN);
      return;
    }
    try {
      const result = await pinMessage(user.id, parsed.data.messageId);
      io.to(result.channelId).emit(SOCKET_EVENTS.PINS_CHANGED, result);
    } catch (error) {
      emitSocketError(
        socket,
        isAppError(error) ? error.message : "Failed to pin message",
        SOCKET_EVENTS.MESSAGE_PIN,
      );
    }
  });

  socket.on(SOCKET_EVENTS.MESSAGE_UNPIN, async (payload: unknown) => {
    const parsed = pinMessageSchema.safeParse(payload);
    if (!parsed.success) {
      emitSocketError(socket, "Invalid unpin payload", SOCKET_EVENTS.MESSAGE_UNPIN);
      return;
    }
    try {
      const result = await unpinMessage(user.id, parsed.data.messageId);
      io.to(result.channelId).emit(SOCKET_EVENTS.PINS_CHANGED, result);
    } catch (error) {
      emitSocketError(
        socket,
        isAppError(error) ? error.message : "Failed to unpin message",
        SOCKET_EVENTS.MESSAGE_UNPIN,
      );
    }
  });

  socket.on(SOCKET_EVENTS.TYPING_START, async (payload: unknown) => {
    const parsed = typingSchema.safeParse(payload);
    if (!parsed.success) return;

    try {
      await assertChannelMember(user.id, parsed.data.channelId);
      socket.to(parsed.data.channelId).emit(SOCKET_EVENTS.TYPING_START, {
        channelId: parsed.data.channelId,
        userId: user.id,
        displayName: user.displayName,
      });
    } catch {
      // ignore unauthorized typing
    }
  });

  socket.on(SOCKET_EVENTS.TYPING_STOP, async (payload: unknown) => {
    const parsed = typingSchema.safeParse(payload);
    if (!parsed.success) return;

    try {
      await assertChannelMember(user.id, parsed.data.channelId);
      socket.to(parsed.data.channelId).emit(SOCKET_EVENTS.TYPING_STOP, {
        channelId: parsed.data.channelId,
        userId: user.id,
      });
    } catch {
      // ignore unauthorized typing
    }
  });
}
