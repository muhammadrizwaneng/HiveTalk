"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  slugifyWorkspaceName,
  workspaceHost,
  type PublicUser,
} from "@hivetalk/shared";
import { ApiError, api } from "@/lib/api";

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

/** Workspace hub: open existing memberships, or create a new one. */
export default function NewWorkspacePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: me } = await api.me();
        const { workspaces: list } = await api.listWorkspaces();
        if (cancelled) return;
        setUser(me);
        setWorkspaces(list);
        // Invited users: jump straight into their workspace
        if (list.length === 1 && list[0]?.slug) {
          router.replace(`/w/${list[0].slug}`);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const previewSlug = name.trim() ? slugifyWorkspaceName(name.trim()) : "…";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const { workspace } = await api.createWorkspace(name.trim());
      router.replace(`/w/${workspace.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1a1d21] px-4 text-[#d1d2d3]">
      <div className="w-full max-w-md rounded-xl bg-[#3f0e40] p-6 shadow-lg">
        <h1 className="text-xl font-bold text-white">Your workspaces</h1>
        <p className="mt-1 text-sm text-[#cfc3cf]">
          Signed in as {user.displayName}. If someone invited you, open their
          workspace below (or ask them to add your email, then refresh).
        </p>

        {workspaces.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {workspaces.map((ws) => (
              <li key={ws.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/w/${ws.slug}`)}
                  className="flex w-full items-center justify-between rounded bg-[#5c2c5d] px-3 py-2 text-left text-sm text-white hover:bg-[#6d3a6e]"
                >
                  <span>
                    <span className="font-semibold">{ws.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-[#1d9bd1]">
                      {workspaceHost(ws.slug)}
                    </span>
                  </span>
                  <span className="text-[10px] uppercase opacity-60">{ws.role}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded bg-[#5c2c5d]/60 px-3 py-2 text-sm text-[#cfc3cf]">
            No workspace yet. Ask an owner to add your email as a member, then
            refresh this page — or create your own below.
          </p>
        )}

        <hr className="my-5 border-[#522653]" />

        <form onSubmit={(e) => void onSubmit(e)}>
          <h2 className="text-sm font-semibold text-white">Create a workspace</h2>
          <label className="mt-2 block text-xs font-semibold uppercase tracking-wide">
            Workspace name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SeeBiz"
              className="mt-1 w-full rounded bg-[#5c2c5d] px-3 py-2 text-sm text-white"
            />
          </label>
          <p className="mt-2 text-xs text-[#ababad]">
            URL:{" "}
            <span className="font-mono text-[#1d9bd1]">/w/{previewSlug}</span>
            {" · "}
            <span className="font-mono text-white">
              {workspaceHost(previewSlug === "…" ? "name" : previewSlug)}
            </span>
          </p>
          {error && <p className="mt-3 text-sm text-[#e01e5a]">{error}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded bg-[#611f69] py-2 text-sm font-semibold text-white hover:bg-[#7a2b84]"
          >
            Create workspace
          </button>
        </form>
      </div>
    </main>
  );
}
