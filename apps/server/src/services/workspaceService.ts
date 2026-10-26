import type {
  AddWorkspaceMemberInput,
  CreateChannelInput,
  CreateWorkspaceInput,
  SeedDepartmentInput,
} from "@hivetalk/shared";
import {
  DEPARTMENT_CHANNEL_TEMPLATES,
  slugifyWorkspaceName,
} from "@hivetalk/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { toPublicUser } from "../lib/serialize.js";
import { assertWorkspaceMember } from "./membership.js";

const DEFAULT_WORKSPACE_CHANNELS: {
  name: string;
  topic: string;
  department: "GENERAL" | "ENGINEERING" | "HR" | "SOCIAL";
}[] = [
  { name: "general", topic: "Company-wide announcements and work", department: "GENERAL" },
  { name: "random", topic: "Non-work banter", department: "GENERAL" },
  { name: "hr", topic: "HR questions and updates", department: "HR" },
  { name: "engineering", topic: "Engineering discussions", department: "ENGINEERING" },
  { name: "social", topic: "Campaigns and social content", department: "SOCIAL" },
];

async function allocateUniqueSlug(desired: string): Promise<string> {
  let slug = desired;
  let n = 0;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${desired.slice(0, 28)}${n}`;
  }
  return slug;
}

export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput,
) {
  const desired = input.slug?.trim() || slugifyWorkspaceName(input.name);
  const slug = await allocateUniqueSlug(desired);

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: input.name,
        slug,
        ownerId: userId,
        memberships: {
          create: {
            userId,
            role: "OWNER",
          },
        },
        channels: {
          create: DEFAULT_WORKSPACE_CHANNELS.map((c) => ({
            name: c.name,
            topic: c.topic,
            type: "CHANNEL" as const,
            department: c.department,
            isPrivate: false,
          })),
        },
      },
      include: {
        channels: true,
      },
    });

    return workspace;
  });
}

export async function listWorkspacesForUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    createdAt: m.workspace.createdAt.toISOString(),
    role: m.role,
  }));
}

export async function getWorkspaceBySlug(userId: string, slug: string) {
  const workspace = await prisma.workspace.findUnique({ where: { slug } });
  if (!workspace) {
    throw new AppError(404, "Workspace not found");
  }
  const membership = await assertWorkspaceMember(userId, workspace.id);
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt.toISOString(),
    role: membership.role,
  };
}

async function assertMemberIdsInWorkspace(
  workspaceId: string,
  memberIds: string[],
) {
  if (memberIds.length === 0) return;
  const found = await prisma.membership.findMany({
    where: { workspaceId, userId: { in: memberIds } },
    select: { userId: true },
  });
  if (found.length !== new Set(memberIds).size) {
    throw new AppError(
      400,
      "Only users in this workspace can be added to its channels",
    );
  }
}

export async function createChannel(userId: string, input: CreateChannelInput) {
  await assertWorkspaceMember(userId, input.workspaceId);

  const isPrivate = Boolean(input.isPrivate);
  const department = input.department ?? "GENERAL";
  const memberIds = Array.from(
    new Set([userId, ...(input.memberIds ?? [])]),
  );

  await assertMemberIdsInWorkspace(input.workspaceId, memberIds);

  try {
    return await prisma.channel.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        type: "CHANNEL",
        isPrivate,
        department,
        ...(isPrivate
          ? {
              participants: {
                create: memberIds.map((id) => ({ userId: id })),
              },
            }
          : {}),
      },
    });
  } catch {
    throw new AppError(409, "Channel name already exists in this workspace");
  }
}

export async function addChannelMembers(
  actorUserId: string,
  channelId: string,
  memberIds: string[],
) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.type !== "CHANNEL") {
    throw new AppError(404, "Channel not found");
  }

  await assertWorkspaceMember(actorUserId, channel.workspaceId);
  await assertMemberIdsInWorkspace(channel.workspaceId, memberIds);

  if (!channel.isPrivate) {
    throw new AppError(400, "Public channels include all workspace members");
  }

  for (const memberId of memberIds) {
    await prisma.channelParticipant.upsert({
      where: {
        channelId_userId: { channelId, userId: memberId },
      },
      create: { channelId, userId: memberId },
      update: {},
    });
  }

  return listChannels(actorUserId, channel.workspaceId);
}

export async function seedDepartmentChannels(
  userId: string,
  workspaceId: string,
  input: SeedDepartmentInput,
) {
  await assertWorkspaceMember(userId, workspaceId);

  const templates = DEPARTMENT_CHANNEL_TEMPLATES[input.department];
  const created = [];

  for (const tpl of templates) {
    const existing = await prisma.channel.findUnique({
      where: {
        workspaceId_name: { workspaceId, name: tpl.name },
      },
    });
    if (existing) {
      created.push(existing);
      continue;
    }

    const channel = await prisma.channel.create({
      data: {
        workspaceId,
        name: tpl.name,
        topic: tpl.topic,
        type: "CHANNEL",
        department: input.department,
        isPrivate: Boolean(tpl.isPrivate),
        ...(tpl.isPrivate
          ? { participants: { create: [{ userId }] } }
          : {}),
      },
    });
    created.push(channel);
  }

  return created.map((c) => ({
    id: c.id,
    workspaceId: c.workspaceId,
    name: c.name,
    topic: c.topic,
    type: "CHANNEL" as const,
    isPrivate: c.isPrivate,
    department: c.department,
    createdAt: c.createdAt.toISOString(),
    unreadCount: 0,
    starred: false,
  }));
}

export async function listChannels(userId: string, workspaceId: string) {
  await assertWorkspaceMember(userId, workspaceId);

  const channels = await prisma.channel.findMany({
    where: {
      workspaceId,
      type: "CHANNEL",
      OR: [
        { isPrivate: false },
        { isPrivate: true, participants: { some: { userId } } },
      ],
    },
    orderBy: [{ department: "asc" }, { createdAt: "asc" }],
  });

  const { getUnreadCounts } = await import("./readStateService.js");
  const { getStarredChannelIds } = await import("./starService.js");
  const ids = channels.map((c) => c.id);
  const [unread, starred] = await Promise.all([
    getUnreadCounts(userId, ids),
    getStarredChannelIds(userId, ids),
  ]);

  return channels.map((c) => ({
    id: c.id,
    workspaceId: c.workspaceId,
    name: c.name,
    topic: c.topic,
    type: "CHANNEL" as const,
    isPrivate: c.isPrivate,
    department: c.department,
    createdAt: c.createdAt.toISOString(),
    unreadCount: unread[c.id] ?? 0,
    starred: starred.has(c.id),
  }));
}

export async function updateChannelTopic(
  userId: string,
  channelId: string,
  topic: string,
) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    throw new AppError(404, "Channel not found");
  }

  if (channel.type === "DM") {
    const { assertChannelMember } = await import("./membership.js");
    await assertChannelMember(userId, channelId);
  } else {
    await assertWorkspaceMember(userId, channel.workspaceId);
  }

  const updated = await prisma.channel.update({
    where: { id: channelId },
    data: { topic },
  });

  return {
    id: updated.id,
    workspaceId: updated.workspaceId,
    name: updated.name,
    topic: updated.topic,
    type: updated.type,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function listMembers(userId: string, workspaceId: string) {
  await assertWorkspaceMember(userId, workspaceId);

  const memberships = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    role: m.role,
    user: toPublicUser(m.user),
  }));
}

export async function addMemberByEmail(
  actorUserId: string,
  workspaceId: string,
  input: AddWorkspaceMemberInput,
) {
  const membership = await assertWorkspaceMember(actorUserId, workspaceId);

  if (membership.role === "MEMBER") {
    throw new AppError(403, "Only owners and admins can add members");
  }

  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new AppError(
      404,
      "No account found for that email. Ask them to register first.",
    );
  }

  const existing = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId },
    },
  });

  if (existing) {
    throw new AppError(409, "User is already a member of this workspace");
  }

  const created = await prisma.membership.create({
    data: {
      userId: user.id,
      workspaceId,
      role: "MEMBER",
    },
    include: { user: true },
  });

  return {
    role: created.role,
    user: toPublicUser(created.user),
  };
}
