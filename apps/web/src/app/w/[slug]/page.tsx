"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PublicUser } from "@hivetalk/shared";
import { ChatApp } from "@/components/ChatApp";
import { ApiError, api } from "@/lib/api";

export default function WorkspacePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: me } = await api.me();
        if (cancelled) return;
        setUser(me);
        // Ensure membership before mounting chat
        await api.getWorkspaceBySlug(slug);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setError("You are not a member of this workspace");
          setLoading(false);
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setError("Workspace not found");
          setLoading(false);
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading…
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#1a1d21] text-[#d1d2d3]">
        <p className="text-sm text-[#e01e5a]">{error}</p>
        <button
          type="button"
          className="rounded bg-[#611f69] px-4 py-2 text-sm text-white"
          onClick={() => router.replace("/w")}
        >
          Your workspaces
        </button>
      </main>
    );
  }

  if (!user) return null;

  return <ChatApp user={user} initialSlug={slug} />;
}
