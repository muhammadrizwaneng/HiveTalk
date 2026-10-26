import type { PublicUser } from "@hivetalk/shared";

export function extractMentionQuery(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const match = before.match(/@([^\s@]*)$/);
  if (!match) return null;
  return {
    query: match[1] ?? "",
    start: before.length - (match[0]?.length ?? 0),
  };
}

export function applyMention(
  text: string,
  start: number,
  cursor: number,
  displayName: string,
) {
  const before = text.slice(0, start);
  const after = text.slice(cursor);
  const insertion = `@${displayName} `;
  const next = `${before}${insertion}${after}`;
  return {
    text: next,
    cursor: before.length + insertion.length,
  };
}

export function messageMentionsUser(content: string, user: PublicUser) {
  const needle = `@${user.displayName}`;
  return content.includes(needle);
}

export function renderMessageContent(content: string, members: PublicUser[]) {
  const names = members
    .map((m) => m.displayName)
    .sort((a, b) => b.length - a.length);
  if (!names.length) return content;

  const pattern = new RegExp(
    `(@(?:${names.map(escapeRegExp).join("|")}))`,
    "g",
  );
  const parts = content.split(pattern);
  return parts.map((part, i) => {
    if (part.startsWith("@") && names.includes(part.slice(1))) {
      return (
        <span key={i} className="rounded bg-[#1a3a4a] px-0.5 text-[#1d9bd1]">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function requestNotifyPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

export function notifyDesktop(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return;
  try {
    new Notification(title, { body, silent: false });
  } catch {
    // ignore
  }
}
