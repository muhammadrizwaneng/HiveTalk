"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";

/** Legacy /app → jump into first workspace URL (/w/slug). */
export default function AppRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.me();
        const { workspaces } = await api.listWorkspaces();
        if (cancelled) return;
        if (workspaces[0]?.slug) {
          router.replace(`/w/${workspaces[0].slug}`);
        } else {
          router.replace("/w");
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
      Loading…
    </main>
  );
}
