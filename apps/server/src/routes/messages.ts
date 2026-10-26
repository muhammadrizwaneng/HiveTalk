import { Router } from "express";
import { markReadSchema, pinMessageSchema } from "@hivetalk/shared";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  listMessages,
  listThreadReplies,
} from "../services/messageService.js";
import {
  listPins,
  pinMessage,
  unpinMessage,
} from "../services/pinService.js";
import { markChannelRead } from "../services/readStateService.js";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.post(
  "/read",
  validate(markReadSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await markChannelRead(user.id, req.body.channelId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

messagesRouter.get(
  "/thread/:messageId",
  validate(z.object({ messageId: z.string().cuid() }), "params"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const thread = await listThreadReplies(user.id, req.params.messageId!);
      res.json(thread);
    } catch (error) {
      next(error);
    }
  },
);

messagesRouter.get(
  "/pins/:channelId",
  validate(z.object({ channelId: z.string().cuid() }), "params"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const pins = await listPins(user.id, req.params.channelId!);
      res.json({ pins });
    } catch (error) {
      next(error);
    }
  },
);

messagesRouter.post(
  "/pin",
  validate(pinMessageSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const result = await pinMessage(user.id, req.body.messageId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

messagesRouter.post(
  "/unpin",
  validate(pinMessageSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const result = await unpinMessage(user.id, req.body.messageId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

messagesRouter.get(
  "/:channelId",
  validate(z.object({ channelId: z.string().cuid() }), "params"),
  validate(
    z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
    "query",
  ),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const limit =
        typeof req.query.limit === "number" ? req.query.limit : undefined;
      const messages = await listMessages(
        user.id,
        req.params.channelId!,
        limit,
      );
      res.json({ messages });
    } catch (error) {
      next(error);
    }
  },
);
