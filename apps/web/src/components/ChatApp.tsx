"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  REACTION_EMOJIS,
  SOCKET_EVENTS,
  workspaceHost,
  type ActivityItem,
  type ChannelSummary,
  type Department,
  type DmSummary,
  type MessageDto,
  type PublicUser,
  type SearchHit,
} from "@hivetalk/shared";
import { CommandPalette } from "@/components/CommandPalette";
import { ApiError, api } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import {
  applyMention,
  extractMentionQuery,
  messageMentionsUser,
  notifyDesktop,
  requestNotifyPermission,
} from "@/lib/mentions";
import { disconnectSocket, getSocket } from "@/lib/socket";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type ActiveChat =
  | { kind: "channel"; data: ChannelSummary }
  | { kind: "dm"; data: DmSummary };

export function ChatApp({
  user,
  initialSlug,
}: {
  user: PublicUser;
  initialSlug?: string;
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [dms, setDms] = useState<DmSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [channelMemberIds, setChannelMemberIds] = useState<string[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelPrivate, setChannelPrivate] = useState(false);
  const [channelDept, setChannelDept] = useState<Department>("GENERAL");
  const [inviteEmail, setInviteEmail] = useState("");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<"jump" | "help">("jump");
  const [socketConnected, setSocketConnected] = useState(true);
  const [pendingOutbox, setPendingOutbox] = useState<
    { channelId: string; content: string }[]
  >([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [members, setMembers] = useState<{ role: string; user: PublicUser }[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [threadParent, setThreadParent] = useState<MessageDto | null>(null);
  const [threadReplies, setThreadReplies] = useState<MessageDto[]>([]);
  const [threadDraft, setThreadDraft] = useState("");
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pins, setPins] = useState<MessageDto[]>([]);
  const [showPins, setShowPins] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [editingTopic, setEditingTopic] = useState(false);
  const [statusText, setStatusText] = useState(user.statusText ?? "");
  const [statusEmoji, setStatusEmoji] = useState(user.statusEmoji ?? "");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);

  const activeChat: ActiveChat | null = useMemo(() => {
    if (!activeChannelId) return null;
    const channel = channels.find((c) => c.id === activeChannelId);
    if (channel) return { kind: "channel", data: channel };
    const dm = dms.find((d) => d.id === activeChannelId);
    if (dm) return { kind: "dm", data: dm };
    return null;
  }, [activeChannelId, channels, dms]);

  const loadWorkspaces = useCallback(async () => {
    try {
      const { workspaces: list } = await api.listWorkspaces();
      setWorkspaces(list);
      if (initialSlug) {
        const match = list.find((w) => w.slug === initialSlug);
        if (match) {
          setActiveWorkspaceId(match.id);
          return;
        }
        setError("You are not a member of this workspace");
        return;
      }
      if (!activeWorkspaceId && list[0]) {
        setActiveWorkspaceId(list[0].id);
        router.replace(`/w/${list[0].slug}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      throw err;
    }
  }, [activeWorkspaceId, initialSlug, router]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const loadWorkspaceData = useCallback(async (workspaceId: string) => {
    const [{ channels: channelList }, { dms: dmList }, { members: memberList }] =
      await Promise.all([
        api.listChannels(workspaceId),
        api.listDms(workspaceId),
        api.listMembers(workspaceId),
      ]);
    setChannels(channelList);
    setDms(dmList);
    setMembers(memberList);
    setActiveChannelId((current) => {
      if (
        current &&
        (channelList.some((c) => c.id === current) ||
          dmList.some((d) => d.id === current))
      ) {
        return current;
      }
      return channelList[0]?.id ?? dmList[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    loadWorkspaces().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load workspaces"),
    );
    requestNotifyPermission();
  }, [loadWorkspaces]);

  function switchWorkspace(ws: Workspace) {
    setActiveWorkspaceId(ws.id);
    setActiveChannelId(null);
    setThreadParentId(null);
    router.push(`/w/${ws.slug}`);
  }

  const memberUsers = useMemo(() => members.map((m) => m.user), [members]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return memberUsers
      .filter(
        (m) =>
          m.id !== user.id &&
          m.displayName.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [mentionQuery, memberUsers, user.id]);

  const starredChannels = useMemo(
    () => channels.filter((c) => c.starred),
    [channels],
  );
  const starredDms = useMemo(() => dms.filter((d) => d.starred), [dms]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    loadWorkspaceData(activeWorkspaceId).catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load workspace"),
    );

    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit(SOCKET_EVENTS.WORKSPACE_JOIN, { workspaceId: activeWorkspaceId });

    const onPresence = (payload: {
      workspaceId: string;
      onlineUserIds: string[];
    }) => {
      if (payload.workspaceId === activeWorkspaceId) {
        setOnlineUserIds(payload.onlineUserIds);
      }
    };
    const onStatus = (payload: { user: PublicUser }) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.user.id === payload.user.id ? { ...m, user: payload.user } : m,
        ),
      );
    };

    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
    socket.on(SOCKET_EVENTS.STATUS_CHANGED, onStatus);
    return () => {
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
      socket.off(SOCKET_EVENTS.STATUS_CHANGED, onStatus);
    };
  }, [activeWorkspaceId, loadWorkspaceData]);

  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    api
      .listMessages(activeChannelId)
      .then(({ messages: list }) => {
        if (!cancelled) {
          setMessages(list);
          requestAnimationFrame(() =>
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load messages");
        }
      });

    api
      .listPins(activeChannelId)
      .then(({ pins: list }) => {
        if (!cancelled) setPins(list);
      })
      .catch(() => {
        if (!cancelled) setPins([]);
      });

    void api.markRead(activeChannelId).then(() => {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === activeChannelId ? { ...c, unreadCount: 0 } : c,
        ),
      );
      setDms((prev) =>
        prev.map((d) =>
          d.id === activeChannelId ? { ...d, unreadCount: 0 } : d,
        ),
      );
    });

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onConnect = () => {
      setConnected(true);
      setSocketConnected(true);
      setPendingOutbox((queue) => {
        const socket = getSocket();
        for (const item of queue) {
          socket.emit(SOCKET_EVENTS.MESSAGE_CREATE, item);
        }
        return [];
      });
    };
    const onDisconnect = () => {
      setConnected(false);
      setSocketConnected(false);
    };

    const upsertMessage = (message: MessageDto) => {
      if (
        message.authorId !== user.id &&
        (message.channelId !== activeChannelId || document.hidden)
      ) {
        const title =
          message.author?.displayName ?? "New message";
        notifyDesktop(title, message.content.slice(0, 120));
      }

      if (message.channelId !== activeChannelId) return;
      if (message.parentId) {
        if (threadParentId === message.parentId) {
          setThreadReplies((prev) =>
            prev.some((m) => m.id === message.id) ? prev : [...prev, message],
          );
          setThreadParent((p) =>
            p ? { ...p, replyCount: (p.replyCount ?? 0) + 1 } : p,
          );
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.parentId
              ? { ...m, replyCount: (m.replyCount ?? 0) + 1 }
              : m,
          ),
        );
        return;
      }
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
      requestAnimationFrame(() =>
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      );
    };

    const onCreated = (message: MessageDto) => upsertMessage(message);
    const onUpdated = (message: MessageDto) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? message : m)),
      );
      setThreadReplies((prev) =>
        prev.map((m) => (m.id === message.id ? message : m)),
      );
      if (threadParent?.id === message.id) setThreadParent(message);
    };
    const onDeleted = (payload: {
      messageId: string;
      channelId: string;
      parentId?: string | null;
    }) => {
      if (payload.channelId !== activeChannelId) return;
      setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
      setThreadReplies((prev) => prev.filter((m) => m.id !== payload.messageId));
      if (threadParentId === payload.messageId) {
        setThreadParentId(null);
        setThreadParent(null);
        setThreadReplies([]);
      }
    };
    const onReaction = (message: MessageDto) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? message : m)),
      );
      setThreadReplies((prev) =>
        prev.map((m) => (m.id === message.id ? message : m)),
      );
      if (threadParent?.id === message.id) setThreadParent(message);
    };
    const onTypingStart = (payload: {
      channelId: string;
      userId: string;
      displayName: string;
    }) => {
      if (payload.channelId !== activeChannelId || payload.userId === user.id)
        return;
      setTypingUsers((prev) => ({
        ...prev,
        [payload.userId]: payload.displayName,
      }));
    };
    const onTypingStop = (payload: { channelId: string; userId: string }) => {
      if (payload.channelId !== activeChannelId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[payload.userId];
        return next;
      });
    };
    const onError = (payload: { message: string }) => setError(payload.message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(SOCKET_EVENTS.MESSAGE_CREATED, onCreated);
    socket.on(SOCKET_EVENTS.MESSAGE_UPDATED, onUpdated);
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, onDeleted);
    const onPins = (payload: { channelId: string; pins: MessageDto[] }) => {
      if (payload.channelId === activeChannelId) setPins(payload.pins);
    };

    socket.on(SOCKET_EVENTS.REACTION_CHANGED, onReaction);
    socket.on(SOCKET_EVENTS.PINS_CHANGED, onPins);
    socket.on(SOCKET_EVENTS.TYPING_START, onTypingStart);
    socket.on(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
    socket.on(SOCKET_EVENTS.ERROR, onError);
    socket.emit(SOCKET_EVENTS.CHANNEL_JOIN, { channelId: activeChannelId });
    setConnected(socket.connected);

    return () => {
      cancelled = true;
      socket.emit(SOCKET_EVENTS.CHANNEL_LEAVE, { channelId: activeChannelId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(SOCKET_EVENTS.MESSAGE_CREATED, onCreated);
      socket.off(SOCKET_EVENTS.MESSAGE_UPDATED, onUpdated);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, onDeleted);
      socket.off(SOCKET_EVENTS.REACTION_CHANGED, onReaction);
      socket.off(SOCKET_EVENTS.PINS_CHANGED, onPins);
      socket.off(SOCKET_EVENTS.TYPING_START, onTypingStart);
      socket.off(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
      socket.off(SOCKET_EVENTS.ERROR, onError);
      setTypingUsers({});
    };
  }, [activeChannelId, threadParentId, threadParent?.id, user.id]);

  useEffect(() => {
    if (activeChat?.kind === "channel") {
      setTopicDraft(activeChat.data.topic ?? "");
    } else {
      setTopicDraft("");
    }
    setEditingTopic(false);
    setShowPins(false);
  }, [activeChat]);

  useEffect(() => {
    if (!activeChannelId) return;
    api
      .getDraft(activeChannelId)
      .then(({ draft }) => {
        if (draft.content) setDraft(draft.content);
      })
      .catch(() => undefined);
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId) return;
    const handle = setTimeout(() => {
      void api.saveDraft(activeChannelId, draft).catch(() => undefined);
    }, 600);
    return () => clearTimeout(handle);
  }, [draft, activeChannelId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteMode("jump");
        setPaletteOpen(true);
      }
      if (meta && e.key === "/") {
        e.preventDefault();
        setPaletteMode("help");
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function refreshActivity() {
    if (!activeWorkspaceId) return;
    try {
      const { activity: items } = await api.activity(activeWorkspaceId);
      setActivity(items);
      setShowActivity(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    }
  }

  function emitTyping() {
    if (!activeChannelId) return;
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.TYPING_START, { channelId: activeChannelId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.TYPING_STOP, { channelId: activeChannelId });
    }, 1200);
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    try {
      const { workspace } = await api.createWorkspace(workspaceName.trim());
      setWorkspaceName("");
      router.push(`/w/${workspace.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    }
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId || !channelName.trim()) return;
    try {
      const memberIds = channelPrivate
        ? Array.from(new Set([user.id, ...channelMemberIds]))
        : undefined;
      const { channel } = await api.createChannel(
        activeWorkspaceId,
        channelName.trim().toLowerCase(),
        {
          isPrivate: channelPrivate,
          department: channelDept,
          memberIds,
        },
      );
      setChannelName("");
      setChannelPrivate(false);
      setChannelDept("GENERAL");
      setChannelMemberIds([]);
      setChannels((prev) => [...prev, { ...channel, unreadCount: 0 }]);
      setActiveChannelId(channel.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    }
  }

  async function seedTeam(department: "ENGINEERING" | "HR" | "SOCIAL") {
    if (!activeWorkspaceId) return;
    try {
      const { channels: seeded } = await api.seedDepartment(
        activeWorkspaceId,
        department,
      );
      setChannels((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...seeded.filter((c) => !ids.has(c.id))];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed team channels");
    }
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId || !inviteEmail.trim()) return;
    try {
      const { member } = await api.addMember(
        activeWorkspaceId,
        inviteEmail.trim(),
      );
      setInviteEmail("");
      setMembers((prev) =>
        prev.some((m) => m.user.id === member.user.id)
          ? prev
          : [...prev, member],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  }

  async function openDmWith(peerUserId: string) {
    if (!activeWorkspaceId) return;
    try {
      const { dm } = await api.openDm(activeWorkspaceId, peerUserId);
      setDms((prev) =>
        prev.some((d) => d.id === dm.id) ? prev : [{ ...dm, unreadCount: 0 }, ...prev],
      );
      setActiveChannelId(dm.id);
      setThreadParentId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open DM");
    }
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId || !searchQ.trim()) {
      setSearchHits([]);
      return;
    }
    try {
      const { results } = await api.search(activeWorkspaceId, searchQ.trim());
      setSearchHits(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChannelId || !draft.trim()) return;
    const payload = {
      channelId: activeChannelId,
      content: draft.trim(),
      attachmentIds: pendingAttachmentIds.length
        ? pendingAttachmentIds
        : undefined,
    };
    const socket = getSocket();
    if (!socket.connected) {
      setPendingOutbox((q) => [...q, { channelId: payload.channelId, content: payload.content }]);
      setDraft("");
      setPendingAttachmentIds([]);
      setError("Offline — message queued and will send when reconnected");
      return;
    }
    socket.emit(SOCKET_EVENTS.MESSAGE_CREATE, payload);
    socket.emit(SOCKET_EVENTS.TYPING_STOP, { channelId: activeChannelId });
    setDraft("");
    setPendingAttachmentIds([]);
    void api.saveDraft(activeChannelId, "").catch(() => undefined);
  }

  function sendThreadReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChannelId || !threadParentId || !threadDraft.trim()) return;
    getSocket().emit(SOCKET_EVENTS.MESSAGE_CREATE, {
      channelId: activeChannelId,
      content: threadDraft.trim(),
      parentId: threadParentId,
    });
    setThreadDraft("");
  }

  async function openThread(messageId: string) {
    try {
      const thread = await api.getThread(messageId);
      setThreadParentId(messageId);
      setThreadParent(thread.parent);
      setThreadReplies(thread.replies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open thread");
    }
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const { attachment } = await api.uploadFile(file);
      setPendingAttachmentIds((prev) => [...prev, attachment.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleReaction(messageId: string, emoji: string, me: boolean) {
    const socket = getSocket();
    socket.emit(
      me ? SOCKET_EVENTS.REACTION_REMOVE : SOCKET_EVENTS.REACTION_ADD,
      { messageId, emoji },
    );
  }

  function saveEdit(messageId: string) {
    if (!editDraft.trim()) return;
    getSocket().emit(SOCKET_EVENTS.MESSAGE_UPDATE, {
      messageId,
      content: editDraft.trim(),
    });
    setEditingId(null);
    setEditDraft("");
  }

  function deleteMsg(messageId: string) {
    if (!window.confirm("Delete this message?")) return;
    getSocket().emit(SOCKET_EVENTS.MESSAGE_DELETE, { messageId });
  }

  function togglePin(messageId: string, currentlyPinned: boolean) {
    getSocket().emit(
      currentlyPinned ? SOCKET_EVENTS.MESSAGE_UNPIN : SOCKET_EVENTS.MESSAGE_PIN,
      { messageId },
    );
  }

  async function toggleStar() {
    if (!activeChannelId) return;
    const isStarred =
      channels.find((c) => c.id === activeChannelId)?.starred ||
      dms.find((d) => d.id === activeChannelId)?.starred;
    try {
      if (isStarred) {
        await api.unstarChannel(activeChannelId);
      } else {
        await api.starChannel(activeChannelId);
      }
      setChannels((prev) =>
        prev.map((c) =>
          c.id === activeChannelId ? { ...c, starred: !isStarred } : c,
        ),
      );
      setDms((prev) =>
        prev.map((d) =>
          d.id === activeChannelId ? { ...d, starred: !isStarred } : d,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update star");
    }
  }

  async function saveTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChannelId) return;
    try {
      const { channel } = await api.updateTopic(activeChannelId, topicDraft);
      setChannels((prev) =>
        prev.map((c) =>
          c.id === activeChannelId ? { ...c, topic: channel.topic } : c,
        ),
      );
      setEditingTopic(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update topic");
    }
  }

  async function saveStatus(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { user: updated } = await api.updateStatus(statusText, statusEmoji);
      setStatusText(updated.statusText ?? "");
      setStatusEmoji(updated.statusEmoji ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  function onDraftChange(value: string, cursor: number) {
    setDraft(value);
    emitTyping();
    const mention = extractMentionQuery(value, cursor);
    if (mention) {
      setMentionQuery(mention.query);
      setMentionStart(mention.start);
    } else {
      setMentionQuery(null);
    }
  }

  function pickMention(member: PublicUser) {
    const cursor = draftInputRef.current?.selectionStart ?? draft.length;
    const result = applyMention(draft, mentionStart, cursor, member.displayName);
    setDraft(result.text);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      draftInputRef.current?.focus();
      draftInputRef.current?.setSelectionRange(result.cursor, result.cursor);
    });
  }

  async function logout() {
    await api.logout();
    disconnectSocket();
    router.push("/login");
    router.refresh();
  }

  const headerTitle = !activeChat
    ? "Select a channel or DM"
    : activeChat.kind === "channel"
      ? `# ${activeChat.data.name}`
      : activeChat.data.peer.displayName;

  const typingLabel = Object.values(typingUsers).join(", ");

  function renderMessage(message: MessageDto, inThread = false) {
    const isMine = message.authorId === user.id;
    return (
      <div
        key={message.id}
        className="group rounded px-2 py-2 hover:bg-[#222529]"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-white">
            {message.author?.displayName ?? "Unknown"}
          </span>
          <span className="text-[11px] text-[#ababad]">
            {new Date(message.createdAt).toLocaleString()}
          </span>
        </div>

        {editingId === message.id ? (
          <div className="mt-1 flex gap-2">
            <input
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className="flex-1 rounded border border-[#565856] bg-[#222529] px-2 py-1 text-sm text-white"
            />
            <button
              type="button"
              className="text-xs text-[#1d9bd1]"
              onClick={() => saveEdit(message.id)}
            >
              Save
            </button>
            <button
              type="button"
              className="text-xs text-[#ababad]"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div
            className={`mt-0.5 text-sm text-[#d1d2d3] ${
              messageMentionsUser(message.content, user)
                ? "rounded bg-[#3d2e1a] px-1"
                : ""
            }`}
          >
            {message.kind && message.kind !== "NORMAL" && (
              <span className="mb-1 inline-block rounded bg-[#3f0e40] px-1.5 text-[10px] uppercase tracking-wide text-[#cfc3cf]">
                {message.kind.replaceAll("_", " ")}
              </span>
            )}
            <div>{renderMarkdown(message.content, memberUsers)}</div>
          </div>
        )}

        {!!message.attachments?.length && (
          <ul className="mt-2 space-y-1">
            {message.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={api.attachmentUrl(a.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#1d9bd1] underline"
                >
                  {a.filename}
                </a>
              </li>
            ))}
          </ul>
        )}

        {!!message.reactions?.length && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => toggleReaction(message.id, r.emoji, r.me)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  r.me
                    ? "border-[#1d9bd1] bg-[#1a3a4a]"
                    : "border-[#565856] bg-[#222529]"
                }`}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        <div className="mt-1 hidden gap-2 group-hover:flex">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="text-sm opacity-80 hover:opacity-100"
              onClick={() =>
                toggleReaction(
                  message.id,
                  emoji,
                  !!message.reactions?.find((r) => r.emoji === emoji && r.me),
                )
              }
            >
              {emoji}
            </button>
          ))}
          {!inThread && !message.parentId && (
            <button
              type="button"
              className="text-xs text-[#ababad] hover:text-white"
              onClick={() => void openThread(message.id)}
            >
              Reply
              {(message.replyCount ?? 0) > 0
                ? ` (${message.replyCount})`
                : ""}
            </button>
          )}
          {!inThread && !message.parentId && (
            <button
              type="button"
              className="text-xs text-[#ababad] hover:text-white"
              onClick={() =>
                togglePin(
                  message.id,
                  pins.some((p) => p.id === message.id),
                )
              }
            >
              {pins.some((p) => p.id === message.id) ? "Unpin" : "Pin"}
            </button>
          )}
          {isMine && (
            <>
              <button
                type="button"
                className="text-xs text-[#ababad] hover:text-white"
                onClick={() => {
                  setEditingId(message.id);
                  setEditDraft(message.content);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-xs text-[#e01e5a] hover:underline"
                onClick={() => deleteMsg(message.id)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1d21] text-[#d1d2d3]">
      <CommandPalette
        open={paletteOpen}
        mode={paletteMode}
        onClose={() => setPaletteOpen(false)}
        channels={channels}
        dms={dms}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setThreadParentId(null);
        }}
      />

      {!socketConnected && (
        <div className="fixed left-0 right-0 top-0 z-40 bg-[#ecb22e] px-4 py-2 text-center text-sm font-medium text-black">
          Reconnecting… {pendingOutbox.length ? `${pendingOutbox.length} queued` : ""}
        </div>
      )}

      {/* Workspace rail */}
      <aside className="flex w-[70px] flex-col items-center gap-2 bg-[#19171d] py-3">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            type="button"
            title={`${ws.name} · ${workspaceHost(ws.slug)}`}
            onClick={() => switchWorkspace(ws)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white ${
              activeWorkspaceId === ws.id
                ? "bg-[#611f69] ring-2 ring-white"
                : "bg-[#3f0e40] hover:rounded-xl"
            }`}
          >
            {ws.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <form
          onSubmit={(e) => void createWorkspace(e)}
          className="mt-auto flex w-full flex-col items-center gap-1 px-1"
        >
          <input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="+"
            title="New workspace name"
            className="w-full rounded bg-[#3f0e40] px-1 py-1 text-center text-xs text-white placeholder:text-[#ababad]"
          />
        </form>
      </aside>

      {/* Sidebar */}
      <aside className="flex w-[260px] flex-col bg-[#3f0e40] text-[#cfc3cf]">
        <div className="border-b border-[#522653] px-4 py-3">
          <p className="truncate text-lg font-bold text-white">
            {activeWorkspace?.name ?? "HiveTalk"}
          </p>
          <p className="truncate font-mono text-[11px] text-[#1d9bd1]">
            {activeWorkspace
              ? workspaceHost(activeWorkspace.slug)
              : "hivetalk"}
          </p>
          <p className="text-xs text-[#cfc3cf]">
            {user.displayName} · {connected ? "online" : "offline"}
          </p>
        </div>

        <form onSubmit={(e) => void runSearch(e)} className="px-3 pt-3">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search messages"
            className="w-full rounded bg-[#5c2c5d] px-2 py-1.5 text-sm text-white placeholder:text-[#cfc3cf]"
          />
        </form>

        {!!searchHits.length && (
          <div className="max-h-40 overflow-y-auto border-b border-[#522653] px-3 py-2">
            {searchHits.map((hit) => (
              <button
                key={hit.message.id}
                type="button"
                className="mb-1 block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-[#522653]"
                onClick={() => {
                  setActiveChannelId(hit.channelId);
                  setSearchHits([]);
                  setSearchQ("");
                }}
              >
                <span className="text-[#1d9bd1]">
                  {hit.channelType === "DM" ? hit.channelName : `#${hit.channelName}`}
                </span>{" "}
                {hit.message.content}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => void saveStatus(e)}
          className="flex gap-1 border-b border-[#522653] px-3 py-2"
        >
          <input
            value={statusEmoji}
            onChange={(e) => setStatusEmoji(e.target.value)}
            placeholder="🙂"
            maxLength={8}
            className="w-10 rounded bg-[#5c2c5d] px-1 py-1 text-center text-sm text-white"
            title="Status emoji"
          />
          <input
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            placeholder="Set a status"
            maxLength={100}
            className="min-w-0 flex-1 rounded bg-[#5c2c5d] px-2 py-1 text-xs text-white"
          />
          <button type="submit" className="text-xs text-white">
            Set
          </button>
        </form>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {(!!starredChannels.length || !!starredDms.length) && (
            <>
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide">
                Starred
              </p>
              <ul className="mb-4 space-y-0.5">
                {starredChannels.map((ch) => (
                  <li key={`star-${ch.id}`}>
                    <button
                      type="button"
                      onClick={() => setActiveChannelId(ch.id)}
                      className={`w-full rounded px-2 py-1 text-left text-sm ${
                        activeChannelId === ch.id
                          ? "bg-[#1164a3] text-white"
                          : "hover:bg-[#522653]"
                      }`}
                    >
                      ★ # {ch.name}
                    </button>
                  </li>
                ))}
                {starredDms.map((dm) => (
                  <li key={`star-dm-${dm.id}`}>
                    <button
                      type="button"
                      onClick={() => setActiveChannelId(dm.id)}
                      className={`w-full rounded px-2 py-1 text-left text-sm ${
                        activeChannelId === dm.id
                          ? "bg-[#1164a3] text-white"
                          : "hover:bg-[#522653]"
                      }`}
                    >
                      ★ {dm.peer.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide">
            Channels
          </p>
          <ul className="mb-4 space-y-0.5">
            {channels.map((ch) => (
              <li key={ch.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveChannelId(ch.id);
                    setThreadParentId(null);
                  }}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm ${
                    activeChannelId === ch.id
                      ? "bg-[#1164a3] text-white"
                      : "hover:bg-[#522653]"
                  }`}
                >
                  <span>
                    {ch.isPrivate ? "🔒 " : "# "}
                    {ch.name}
                    {ch.department && ch.department !== "GENERAL" ? (
                      <span className="ml-1 text-[10px] opacity-60">
                        {ch.department.slice(0, 3)}
                      </span>
                    ) : null}
                  </span>
                  {(ch.unreadCount ?? 0) > 0 && (
                    <span className="rounded-full bg-[#e01e5a] px-1.5 text-[10px] text-white">
                      {ch.unreadCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(e) => void createChannel(e)}
            className="mb-3 flex flex-col gap-1 px-2"
          >
            <div className="flex gap-1">
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="new-channel"
                className="min-w-0 flex-1 rounded bg-[#5c2c5d] px-2 py-1 text-xs text-white"
              />
              <button type="submit" className="text-xs text-white">
                Add
              </button>
            </div>
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={channelPrivate}
                onChange={(e) => {
                  setChannelPrivate(e.target.checked);
                  if (!e.target.checked) setChannelMemberIds([]);
                }}
              />
              Private
            </label>
            {channelPrivate && (
              <div className="max-h-24 overflow-y-auto rounded bg-[#5c2c5d] px-2 py-1 text-[11px]">
                <p className="mb-1 text-[#ababad]">Add workspace members only</p>
                {members
                  .filter((m) => m.user.id !== user.id)
                  .map((m) => (
                    <label
                      key={m.user.id}
                      className="flex items-center gap-2 py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={channelMemberIds.includes(m.user.id)}
                        onChange={(e) => {
                          setChannelMemberIds((prev) =>
                            e.target.checked
                              ? [...prev, m.user.id]
                              : prev.filter((id) => id !== m.user.id),
                          );
                        }}
                      />
                      {m.user.displayName}
                    </label>
                  ))}
                {members.length <= 1 && (
                  <p className="text-[#ababad]">Invite people to the workspace first</p>
                )}
              </div>
            )}
            <select
              value={channelDept}
              onChange={(e) => setChannelDept(e.target.value as Department)}
              className="rounded bg-[#5c2c5d] px-2 py-1 text-[11px] text-white"
            >
              <option value="GENERAL">General</option>
              <option value="ENGINEERING">Engineering</option>
              <option value="HR">HR</option>
              <option value="SOCIAL">Social</option>
            </select>
          </form>

          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide">
            Team packs
          </p>
          <div className="mb-4 flex flex-wrap gap-1 px-2">
            {(["ENGINEERING", "HR", "SOCIAL"] as const).map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => void seedTeam(dept)}
                className="rounded bg-[#5c2c5d] px-2 py-0.5 text-[10px] text-white hover:bg-[#522653]"
              >
                + {dept === "ENGINEERING" ? "Eng" : dept === "SOCIAL" ? "Social" : "HR"}
              </button>
            ))}
          </div>

          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide">
            Direct messages
          </p>
          <ul className="mb-4 space-y-0.5">
            {dms.map((dm) => (
              <li key={dm.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveChannelId(dm.id);
                    setThreadParentId(null);
                  }}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm ${
                    activeChannelId === dm.id
                      ? "bg-[#1164a3] text-white"
                      : "hover:bg-[#522653]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        onlineUserIds.includes(dm.peer.id)
                          ? "bg-[#2bac76]"
                          : "bg-[#ababad]"
                      }`}
                    />
                    {dm.peer.displayName}
                  </span>
                  {(dm.unreadCount ?? 0) > 0 && (
                    <span className="rounded-full bg-[#e01e5a] px-1.5 text-[10px] text-white">
                      {dm.unreadCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide">
            Members
          </p>
          <ul className="mb-3 space-y-0.5">
            {members.map((m) => {
              const isSelf = m.user.id === user.id;
              return (
                <li key={m.user.id}>
                  <button
                    type="button"
                    disabled={isSelf}
                    onClick={() => void openDmWith(m.user.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-[#522653] disabled:opacity-60"
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        onlineUserIds.includes(m.user.id)
                          ? "bg-[#2bac76]"
                          : "bg-[#ababad]"
                      }`}
                    />
                    {m.user.displayName}
                    {isSelf ? " (you)" : ""}
                    {(m.user.statusEmoji || m.user.statusText) && (
                      <span className="ml-1 truncate text-xs opacity-70">
                        {m.user.statusEmoji} {m.user.statusText}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <form
            onSubmit={(e) => void inviteMember(e)}
            className="flex flex-col gap-1 px-2"
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Invite email"
              className="rounded bg-[#5c2c5d] px-2 py-1 text-xs text-white"
            />
            <button type="submit" className="text-left text-xs text-white">
              Add member
            </button>
          </form>
        </div>

        <div className="border-t border-[#522653] p-2">
          <button
            type="button"
            onClick={() => void refreshActivity()}
            className="mb-1 w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#522653]"
          >
            Activity inbox
            {activity.length ? ` (${activity.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => {
              setPaletteMode("help");
              setPaletteOpen(true);
            }}
            className="mb-1 w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#522653]"
          >
            Shortcuts / slash help
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#522653]"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col bg-[#1a1d21]">
        <header className="flex flex-col border-b border-[#2c2d30] px-4 py-2">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white">{headerTitle}</h2>
            <button
              type="button"
              onClick={() => void toggleStar()}
              className="text-sm text-[#ababad] hover:text-[#f2c744]"
              title="Star conversation"
            >
              {(activeChat?.data as ChannelSummary | DmSummary | undefined)
                ?.starred
                ? "★"
                : "☆"}
            </button>
            {!!pins.length && (
              <button
                type="button"
                onClick={() => setShowPins((v) => !v)}
                className="rounded bg-[#222529] px-2 py-0.5 text-xs text-[#ababad] hover:text-white"
              >
                {pins.length} pin{pins.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
          {activeChat?.kind === "channel" && (
            <div className="mt-1">
              {editingTopic ? (
                <form onSubmit={(e) => void saveTopic(e)} className="flex gap-2">
                  <input
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    maxLength={250}
                    placeholder="Add a topic"
                    className="min-w-0 flex-1 rounded border border-[#565856] bg-[#222529] px-2 py-0.5 text-xs text-white"
                  />
                  <button type="submit" className="text-xs text-[#1d9bd1]">
                    Save
                  </button>
                  <button
                    type="button"
                    className="text-xs text-[#ababad]"
                    onClick={() => setEditingTopic(false)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTopic(true)}
                  className="text-left text-xs text-[#ababad] hover:text-white"
                >
                  {activeChat.data.topic?.trim()
                    ? activeChat.data.topic
                    : "Add a channel topic"}
                </button>
              )}
            </div>
          )}
        </header>

        {showPins && !!pins.length && (
          <div className="max-h-40 overflow-y-auto border-b border-[#2c2d30] bg-[#222529] px-3 py-2">
            <p className="mb-1 text-xs font-semibold uppercase text-[#ababad]">
              Pinned messages
            </p>
            {pins.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mb-1 block w-full truncate text-left text-xs text-[#d1d2d3] hover:text-white"
                onClick={() => setShowPins(false)}
              >
                <span className="text-[#1d9bd1]">
                  {p.author?.displayName}:
                </span>{" "}
                {p.content}
              </button>
            ))}
          </div>
        )}

        {showActivity && (
          <div className="max-h-56 overflow-y-auto border-b border-[#2c2d30] bg-[#222529] px-3 py-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-[#ababad]">
                Activity
              </p>
              <button
                type="button"
                className="text-xs text-[#ababad]"
                onClick={() => setShowActivity(false)}
              >
                Close
              </button>
            </div>
            {activity.map((item) => (
              <button
                key={item.id}
                type="button"
                className="mb-1 block w-full truncate text-left text-xs text-[#d1d2d3] hover:text-white"
                onClick={() => {
                  setActiveChannelId(item.channelId);
                  setShowActivity(false);
                }}
              >
                <span className="text-[#1d9bd1]">
                  [{item.type}] {item.channelName}
                </span>{" "}
                {item.message.content}
              </button>
            ))}
            {!activity.length && (
              <p className="text-xs text-[#ababad]">No recent activity</p>
            )}
          </div>
        )}

        {error && (
          <div className="border-b border-[#5e2c2c] bg-[#3d1f1f] px-4 py-2 text-sm text-[#ffb3b3]">
            {error}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => setError(null)}
            >
              dismiss
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
              {messages.map((m) => renderMessage(m))}
              {!messages.length && activeChannelId && (
                <p className="px-2 text-sm text-[#ababad]">
                  No messages yet. Say hello.
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {typingLabel && (
              <p className="px-4 text-xs text-[#ababad]">
                {typingLabel} typing…
              </p>
            )}

            <form
              onSubmit={sendMessage}
              className="relative border-t border-[#2c2d30] p-3"
            >
              {!!pendingAttachmentIds.length && (
                <p className="mb-1 text-xs text-[#ababad]">
                  {pendingAttachmentIds.length} file(s) attached
                </p>
              )}
              {!!mentionSuggestions.length && (
                <div className="absolute bottom-full left-3 z-10 mb-1 w-64 overflow-hidden rounded border border-[#565856] bg-[#222529] shadow-lg">
                  {mentionSuggestions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[#1164a3]"
                      onClick={() => pickMention(m)}
                    >
                      @{m.displayName}
                      {m.statusEmoji ? ` ${m.statusEmoji}` : ""}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 rounded-lg border border-[#565856] bg-[#222529] p-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    void onPickFile(e.target.files?.[0] ?? null)
                  }
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 text-lg text-[#ababad] hover:text-white"
                  title="Attach file"
                >
                  +
                </button>
                <input
                  ref={draftInputRef}
                  value={draft}
                  onChange={(e) =>
                    onDraftChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
                  }
                  disabled={!activeChannelId}
                  placeholder={
                    activeChannelId
                      ? `Message ${headerTitle}`
                      : "Select a channel"
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#ababad]"
                  maxLength={4000}
                />
                <button
                  type="submit"
                  disabled={!activeChannelId || !draft.trim()}
                  className="rounded bg-[#007a5a] px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </form>
          </div>

          {threadParentId && threadParent && (
            <aside className="flex w-[360px] flex-col border-l border-[#2c2d30] bg-[#1a1d21]">
              <div className="flex h-12 items-center justify-between border-b border-[#2c2d30] px-3">
                <p className="font-bold text-white">Thread</p>
                <button
                  type="button"
                  className="text-[#ababad]"
                  onClick={() => {
                    setThreadParentId(null);
                    setThreadParent(null);
                    setThreadReplies([]);
                  }}
                >
                  Close
                </button>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
                {renderMessage(threadParent, true)}
                <p className="px-2 py-2 text-xs uppercase tracking-wide text-[#ababad]">
                  Replies
                </p>
                {threadReplies.map((m) => renderMessage(m, true))}
              </div>
              <form
                onSubmit={sendThreadReply}
                className="border-t border-[#2c2d30] p-3"
              >
                <div className="flex gap-2 rounded-lg border border-[#565856] bg-[#222529] p-2">
                  <input
                    value={threadDraft}
                    onChange={(e) => setThreadDraft(e.target.value)}
                    placeholder="Reply…"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!threadDraft.trim()}
                    className="rounded bg-[#007a5a] px-3 py-1 text-sm text-white disabled:opacity-40"
                  >
                    Reply
                  </button>
                </div>
              </form>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
