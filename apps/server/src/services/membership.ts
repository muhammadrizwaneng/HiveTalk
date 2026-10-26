import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export async function assertWorkspaceMember(
  userId: string,
  workspaceId: string,
) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
  });

  if (!membership) {
    throw new AppError(403, "Not a member of this workspace");
  }

  return membership;
}

export async function assertChannelMember(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      workspaceId: true,
      type: true,
      isPrivate: true,
    },
  });

  if (!channel) {
    throw new AppError(404, "Channel not found");
  }

  if (channel.type === "DM" || channel.isPrivate) {
    const participant = await prisma.channelParticipant.findUnique({
      where: {
        channelId_userId: { channelId, userId },
      },
    });

    if (!participant) {
      throw new AppError(
        403,
        channel.type === "DM"
          ? "Not a participant of this direct message"
          : "Not a member of this private channel",
      );
    }

    return channel;
  }

  await assertWorkspaceMember(userId, channel.workspaceId);
  return channel;
}
