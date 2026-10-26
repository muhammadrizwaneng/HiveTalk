import { Router } from "express";
import {
  addChannelMembersSchema,
  addWorkspaceMemberSchema,
  createChannelSchema,
  createWorkspaceSchema,
  openDmSchema,
  saveDraftSchema,
  searchSchema,
  seedDepartmentSchema,
  starChannelSchema,
  updateChannelTopicSchema,
} from "@hivetalk/shared";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getActivityFeed } from "../services/activityService.js";
import { getDraft, saveDraft } from "../services/draftService.js";
import {
  listDirectMessages,
  openOrCreateDirectMessage,
} from "../services/dmService.js";
import { searchWorkspaceMessages } from "../services/searchService.js";
import { starChannel, unstarChannel } from "../services/starService.js";
import {
  addChannelMembers,
  addMemberByEmail,
  createChannel,
  createWorkspace,
  getWorkspaceBySlug,
  listChannels,
  listMembers,
  listWorkspacesForUser,
  seedDepartmentChannels,
  updateChannelTopic,
} from "../services/workspaceService.js";

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.get("/", async (req, res, next) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const workspaces = await listWorkspacesForUser(user.id);
    res.json({ workspaces });
  } catch (error) {
    next(error);
  }
});

workspacesRouter.post(
  "/",
  validate(createWorkspaceSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const workspace = await createWorkspace(user.id, req.body);
      res.status(201).json({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          createdAt: workspace.createdAt.toISOString(),
          channels: workspace.channels.map((c) => ({
            id: c.id,
            workspaceId: c.workspaceId,
            name: c.name,
            topic: c.topic,
            department: c.department,
            isPrivate: c.isPrivate,
            createdAt: c.createdAt.toISOString(),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/by-slug/:slug",
  validate(
    z.object({
      slug: z
        .string()
        .min(2)
        .max(32)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    }),
    "params",
  ),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const workspace = await getWorkspaceBySlug(user.id, req.params.slug!);
      res.json({ workspace });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/channels/members",
  validate(addChannelMembersSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const channels = await addChannelMembers(
        user.id,
        req.body.channelId,
        req.body.memberIds,
      );
      res.json({ channels });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/:workspaceId/channels",
  validate(z.object({ workspaceId: z.string().cuid() }), "params"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const channels = await listChannels(user.id, req.params.workspaceId!);
      res.json({ channels });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/channels",
  validate(createChannelSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const channel = await createChannel(user.id, req.body);
      res.status(201).json({
        channel: {
          id: channel.id,
          workspaceId: channel.workspaceId,
          name: channel.name,
          topic: channel.topic,
          type: "CHANNEL" as const,
          isPrivate: channel.isPrivate,
          department: channel.department,
          createdAt: channel.createdAt.toISOString(),
          unreadCount: 0,
          starred: false,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/:workspaceId/members",
  validate(z.object({ workspaceId: z.string().cuid() }), "params"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const members = await listMembers(user.id, req.params.workspaceId!);
      res.json({ members });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/:workspaceId/members",
  validate(z.object({ workspaceId: z.string().cuid() }), "params"),
  validate(addWorkspaceMemberSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const member = await addMemberByEmail(
        user.id,
        req.params.workspaceId!,
        req.body,
      );
      res.status(201).json({ member });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/:workspaceId/dms",
  validate(z.object({ workspaceId: z.string().cuid() }), "params"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const dms = await listDirectMessages(user.id, req.params.workspaceId!);
      res.json({ dms });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/:workspaceId/dms",
  validate(z.object({ workspaceId: z.string().cuid() }), "params"),
  validate(openDmSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const dm = await openOrCreateDirectMessage(
        user.id,
        req.params.workspaceId!,
        req.body,
      );
      res.status(201).json({ dm });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/:workspaceId/search",
  validate(z.object({ workspaceId: z.string().cuid() }), "params"),
  validate(searchSchema, "query"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const results = await searchWorkspaceMessages(
        user.id,
        req.params.workspaceId!,
        req.query.q as string,
      );
      res.json({ results });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.patch(
  "/channels/:channelId/topic",
  validate(z.object({ channelId: z.string().cuid() }), "params"),
  validate(updateChannelTopicSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const channel = await updateChannelTopic(
        user.id,
        req.params.channelId!,
        req.body.topic,
      );
      res.json({ channel });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/channels/star",
  validate(starChannelSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await starChannel(user.id, req.body.channelId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/channels/unstar",
  validate(starChannelSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await unstarChannel(user.id, req.body.channelId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/:workspaceId/departments/seed",
  validate(z.object({ workspaceId: z.string().cuid() }), "params"),
  validate(seedDepartmentSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const channels = await seedDepartmentChannels(
        user.id,
        req.params.workspaceId!,
        req.body,
      );
      res.status(201).json({ channels });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/:workspaceId/activity",
  validate(z.object({ workspaceId: z.string().cuid() }), "params"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const activity = await getActivityFeed(user.id, req.params.workspaceId!);
      res.json({ activity });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/drafts/:channelId",
  validate(z.object({ channelId: z.string().cuid() }), "params"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const draft = await getDraft(user.id, req.params.channelId!);
      res.json({ draft });
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.put(
  "/drafts",
  validate(saveDraftSchema),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const draft = await saveDraft(
        user.id,
        req.body.channelId,
        req.body.content,
      );
      res.json({ draft });
    } catch (error) {
      next(error);
    }
  },
);
