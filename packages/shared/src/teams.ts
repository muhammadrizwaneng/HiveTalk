export const DEPARTMENTS = {
  GENERAL: "GENERAL",
  ENGINEERING: "ENGINEERING",
  HR: "HR",
  SOCIAL: "SOCIAL",
} as const;

export type Department = (typeof DEPARTMENTS)[keyof typeof DEPARTMENTS];

export const MESSAGE_KINDS = {
  NORMAL: "NORMAL",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  PTO_REQUEST: "PTO_REQUEST",
  BUG_REPORT: "BUG_REPORT",
  CODE_SNIPPET: "CODE_SNIPPET",
  CAMPAIGN_DRAFT: "CAMPAIGN_DRAFT",
  CONTENT_APPROVAL: "CONTENT_APPROVAL",
} as const;

export type MessageKind = (typeof MESSAGE_KINDS)[keyof typeof MESSAGE_KINDS];

export const DEPARTMENT_CHANNEL_TEMPLATES: Record<
  Exclude<Department, "GENERAL">,
  { name: string; topic: string; isPrivate?: boolean }[]
> = {
  ENGINEERING: [
    { name: "eng-general", topic: "Engineering team discussions" },
    { name: "eng-prs", topic: "Pull requests & code review" },
    { name: "eng-bugs", topic: "Bug reports and incidents" },
    { name: "eng-deploys", topic: "Deploy announcements", isPrivate: true },
  ],
  HR: [
    { name: "hr-announcements", topic: "Company-wide HR announcements" },
    { name: "hr-pto", topic: "PTO and leave requests" },
    { name: "hr-onboarding", topic: "New hire onboarding", isPrivate: true },
    { name: "hr-policies", topic: "Policies and handbook links" },
  ],
  SOCIAL: [
    { name: "social-campaigns", topic: "Campaign planning" },
    { name: "social-approvals", topic: "Content awaiting approval" },
    { name: "social-calendar", topic: "Posting calendar & deadlines" },
    { name: "social-assets", topic: "Creative assets discussion" },
  ],
};

export const SLASH_COMMANDS = [
  {
    command: "/bug",
    department: "ENGINEERING",
    kind: "BUG_REPORT",
    help: "File a bug: /bug title | steps | expected",
  },
  {
    command: "/snippet",
    department: "ENGINEERING",
    kind: "CODE_SNIPPET",
    help: "Share code: /snippet language | code…",
  },
  {
    command: "/pr",
    department: "ENGINEERING",
    kind: "NORMAL",
    help: "Share a PR link: /pr https://… summary",
  },
  {
    command: "/announce",
    department: "HR",
    kind: "ANNOUNCEMENT",
    help: "HR announcement: /announce message",
  },
  {
    command: "/pto",
    department: "HR",
    kind: "PTO_REQUEST",
    help: "Request leave: /pto YYYY-MM-DD to YYYY-MM-DD reason",
  },
  {
    command: "/policy",
    department: "HR",
    kind: "NORMAL",
    help: "Share policy note: /policy title — details",
  },
  {
    command: "/campaign",
    department: "SOCIAL",
    kind: "CAMPAIGN_DRAFT",
    help: "Campaign idea: /campaign name | audience | CTA",
  },
  {
    command: "/approve",
    department: "SOCIAL",
    kind: "CONTENT_APPROVAL",
    help: "Request approval: /approve platform | copy",
  },
  {
    command: "/shrug",
    department: "GENERAL",
    kind: "NORMAL",
    help: "Append ¯\\_(ツ)_/¯",
  },
  {
    command: "/me",
    department: "GENERAL",
    kind: "NORMAL",
    help: "Emote action: /me waves",
  },
] as const;
