# HiveTalk deploy (monorepo)

| App | Platform | Why |
|-----|----------|-----|
| `apps/web` | **Vercel** | Next.js |
| `apps/server` | **Fly.io** | Express + Socket.IO (long-running Node) |

Do **not** put the API on Vercel — sockets won’t work there.

---

## 1. API on Fly.io

```bash
# Install CLI: https://fly.io/docs/flyctl/install/
fly auth login
cd /path/to/HiveTalk   # repo root (has fly.toml + Dockerfile)

# First time — pick a unique app name if hivetalk-api is taken
fly launch --no-deploy   # or: fly apps create hivetalk-api

fly secrets set \
  TURSO_DATABASE_URL="libsql://hivetalk-rizwansar.aws-ap-south-1.turso.io" \
  TURSO_AUTH_TOKEN="YOUR_TURSO_TOKEN" \
  JWT_SECRET="at-least-32-characters-long-secret!!" \
  CLIENT_ORIGIN="https://YOUR-APP.vercel.app"

fly deploy
```

App URL will look like: `https://hivetalk-api.fly.dev`  
Health check: `https://hivetalk-api.fly.dev/health`

Push DB schema once (local, with Turso token in `.env`):

```bash
npm run db:push:turso
```

Free allowance is limited; machines can auto-stop when idle (`min_machines_running = 0` in `fly.toml`) — first request after sleep may be slow.

---

## 2. Web on Vercel

1. Import GitHub repo → deploy **only `apps/web`** (skip `apps/server`).
2. Env vars:

```text
NEXT_PUBLIC_API_URL=https://hivetalk-api.fly.dev
NEXT_PUBLIC_WS_URL=https://hivetalk-api.fly.dev
```

3. After Vercel URL exists, update Fly:

```bash
fly secrets set CLIENT_ORIGIN="https://YOUR-APP.vercel.app"
```

---

## Why not both on Vercel?

Socket.IO needs a real Node process. Fly runs that; Vercel serverless does not.
