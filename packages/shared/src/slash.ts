import type { MessageKind } from "./teams.js";

export interface ParsedSlash {
  content: string;
  kind: MessageKind;
}

export function parseSlashCommand(raw: string): ParsedSlash | null {
  const text = raw.trim();
  if (!text.startsWith("/")) return null;

  const [cmd, ...restParts] = text.split(/\s+/);
  const rest = restParts.join(" ").trim();
  const command = (cmd ?? "").toLowerCase();

  switch (command) {
    case "/shrug":
      return {
        kind: "NORMAL",
        content: `${rest} ¯\\_(ツ)_/¯`.trim(),
      };
    case "/me":
      return {
        kind: "NORMAL",
        content: `_${rest || "does something"}_`,
      };
    case "/bug": {
      const [title, steps, expected] = rest.split("|").map((s) => s.trim());
      return {
        kind: "BUG_REPORT",
        content: [
          `**Bug:** ${title || "Untitled"}`,
          steps ? `**Steps:** ${steps}` : null,
          expected ? `**Expected:** ${expected}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
    case "/snippet": {
      const sep = rest.indexOf("|");
      const lang = (sep >= 0 ? rest.slice(0, sep) : "text").trim() || "text";
      const code = (sep >= 0 ? rest.slice(sep + 1) : rest).trim();
      return {
        kind: "CODE_SNIPPET",
        content: "```" + lang + "\n" + code + "\n```",
      };
    }
    case "/pr":
      return {
        kind: "NORMAL",
        content: `**PR review requested**\n${rest}`,
      };
    case "/announce":
      return {
        kind: "ANNOUNCEMENT",
        content: `📢 **HR Announcement**\n${rest}`,
      };
    case "/pto":
      return {
        kind: "PTO_REQUEST",
        content: `🏖️ **PTO request**\n${rest}`,
      };
    case "/policy":
      return {
        kind: "NORMAL",
        content: `📋 **Policy note**\n${rest}`,
      };
    case "/campaign": {
      const [name, audience, cta] = rest.split("|").map((s) => s.trim());
      return {
        kind: "CAMPAIGN_DRAFT",
        content: [
          `📣 **Campaign:** ${name || "Untitled"}`,
          audience ? `**Audience:** ${audience}` : null,
          cta ? `**CTA:** ${cta}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
    case "/approve": {
      const [platform, copy] = rest.split("|").map((s) => s.trim());
      return {
        kind: "CONTENT_APPROVAL",
        content: [
          `✅ **Approval requested** (${platform || "channel"})`,
          copy || rest,
        ].join("\n"),
      };
    }
    default:
      return null;
  }
}
