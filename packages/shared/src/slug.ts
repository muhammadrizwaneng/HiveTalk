/** Derive a URL slug from a workspace name (e.g. "SeeBiz" → "seebiz"). */
export function slugifyWorkspaceName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
  return base.length >= 2 ? base : `ws${base || "pace"}`;
}

/** Display host for a workspace, e.g. hivetalk.seebiz */
export function workspaceHost(slug: string): string {
  return `hivetalk.${slug}`;
}
