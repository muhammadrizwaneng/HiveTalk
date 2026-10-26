"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  slugifyWorkspaceName,
  workspaceHost,
  type PublicUser,
} from "@hivetalk/shared";
import { ApiError, api } from "@/lib/api";

/** No workspace yet — create one (gets /w/{slug} · hivetalk.{slug}). */
export default function NewWorkspacePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(({ user: me }) => setUser(me))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/login");
      })
      .finally(() => setLoading(false));
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
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-md rounded-xl bg-[#3f0e40] p-6 shadow-lg"
      >
        <h1 className="text-xl font-bold text-white">Create a workspace</h1>
        <p className="mt-1 text-sm text-[#cfc3cf]">
          Signed in as {user.displayName}. Workspaces are private — only invited
          members can see them.
        </p>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide">
          Workspace name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SeeBiz"
            className="mt-1 w-full rounded bg-[#5c2c5d] px-3 py-2 text-sm text-white"
            autoFocus
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
    </main>
  );
}
