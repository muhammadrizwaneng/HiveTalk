import type {
  ActivityItem,
  AttachmentDto,
  AuthResponse,
  ChannelSummary,
  Department,
  DmSummary,
  LoginInput,
  MessageDto,
  PublicUser,
  RegisterInput,
  SearchHit,
  WorkspaceSummary,
} from "@hivetalk/shared";
import { API_URL } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  register: (input: RegisterInput) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  login: (input: LoginInput) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  logout: () =>
    request<void>("/api/auth/logout", {
      method: "POST",
    }),

  me: () => request<{ user: PublicUser }>("/api/auth/me"),

  updateStatus: (statusText: string, statusEmoji: string) =>
    request<{ user: PublicUser }>("/api/auth/me/status", {
      method: "PATCH",
      body: JSON.stringify({ statusText, statusEmoji }),
    }),

  listWorkspaces: () =>
    request<{ workspaces: (WorkspaceSummary & { role: string })[] }>(
      "/api/workspaces",
    ),

  getWorkspaceBySlug: (slug: string) =>
    request<{ workspace: WorkspaceSummary & { role: string } }>(
      `/api/workspaces/by-slug/${encodeURIComponent(slug)}`,
    ),

  createWorkspace: (name: string, slug?: string) =>
    request<{
      workspace: WorkspaceSummary & { channels: ChannelSummary[] };
    }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, ...(slug ? { slug } : {}) }),
    }),

  listChannels: (workspaceId: string) =>
    request<{ channels: ChannelSummary[] }>(
      `/api/workspaces/${workspaceId}/channels`,
    ),

  createChannel: (
    workspaceId: string,
    name: string,
    opts?: {
      isPrivate?: boolean;
      department?: Department;
      memberIds?: string[];
    },
  ) =>
    request<{ channel: ChannelSummary }>("/api/workspaces/channels", {
      method: "POST",
      body: JSON.stringify({
        workspaceId,
        name,
        isPrivate: opts?.isPrivate ?? false,
        department: opts?.department ?? "GENERAL",
        memberIds: opts?.memberIds,
      }),
    }),

  addChannelMembers: (channelId: string, memberIds: string[]) =>
    request<{ channels: ChannelSummary[] }>("/api/workspaces/channels/members", {
      method: "POST",
      body: JSON.stringify({ channelId, memberIds }),
    }),

  seedDepartment: (
    workspaceId: string,
    department: "ENGINEERING" | "HR" | "SOCIAL",
  ) =>
    request<{ channels: ChannelSummary[] }>(
      `/api/workspaces/${workspaceId}/departments/seed`,
      {
        method: "POST",
        body: JSON.stringify({ department }),
      },
    ),

  activity: (workspaceId: string) =>
    request<{ activity: ActivityItem[] }>(
      `/api/workspaces/${workspaceId}/activity`,
    ),

  getDraft: (channelId: string) =>
    request<{ draft: { channelId: string; content: string } }>(
      `/api/workspaces/drafts/${channelId}`,
    ),

  saveDraft: (channelId: string, content: string) =>
    request<{ draft: { channelId: string; content: string } }>(
      "/api/workspaces/drafts",
      {
        method: "PUT",
        body: JSON.stringify({ channelId, content }),
      },
    ),

  listMembers: (workspaceId: string) =>
    request<{
      members: { role: string; user: PublicUser }[];
    }>(`/api/workspaces/${workspaceId}/members`),

  addMember: (workspaceId: string, email: string) =>
    request<{ member: { role: string; user: PublicUser } }>(
      `/api/workspaces/${workspaceId}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    ),

  listDms: (workspaceId: string) =>
    request<{ dms: DmSummary[] }>(`/api/workspaces/${workspaceId}/dms`),

  openDm: (workspaceId: string, userId: string) =>
    request<{ dm: DmSummary }>(`/api/workspaces/${workspaceId}/dms`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  search: (workspaceId: string, q: string) =>
    request<{ results: SearchHit[] }>(
      `/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(q)}`,
    ),

  listMessages: (channelId: string) =>
    request<{ messages: MessageDto[] }>(`/api/messages/${channelId}`),

  getThread: (messageId: string) =>
    request<{ parent: MessageDto; replies: MessageDto[] }>(
      `/api/messages/thread/${messageId}`,
    ),

  markRead: (channelId: string) =>
    request<void>("/api/messages/read", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),

  listPins: (channelId: string) =>
    request<{ pins: MessageDto[] }>(`/api/messages/pins/${channelId}`),

  pinMessage: (messageId: string) =>
    request<{ channelId: string; pins: MessageDto[] }>("/api/messages/pin", {
      method: "POST",
      body: JSON.stringify({ messageId }),
    }),

  unpinMessage: (messageId: string) =>
    request<{ channelId: string; pins: MessageDto[] }>("/api/messages/unpin", {
      method: "POST",
      body: JSON.stringify({ messageId }),
    }),

  updateTopic: (channelId: string, topic: string) =>
    request<{ channel: ChannelSummary }>(
      `/api/workspaces/channels/${channelId}/topic`,
      {
        method: "PATCH",
        body: JSON.stringify({ topic }),
      },
    ),

  starChannel: (channelId: string) =>
    request<void>("/api/workspaces/channels/star", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),

  unstarChannel: (channelId: string) =>
    request<void>("/api/workspaces/channels/unstar", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),

  uploadFile: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ attachment: AttachmentDto }>("/api/attachments", {
      method: "POST",
      body: form,
    });
  },

  attachmentUrl: (id: string) => `${API_URL}/api/attachments/${id}`,
};
