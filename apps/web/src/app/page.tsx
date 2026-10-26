import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        HiveTalk
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        Real-time team messaging
      </h1>
      <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
        Workspaces, channels, and live messages powered by Next.js, Express,
        Socket.IO, and PostgreSQL.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
