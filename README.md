# HiveTalk

Original real-time team messaging app (monorepo).

## Structure

```
apps/web          Next.js App Router UI  → deploy on Vercel
apps/server       Express + Socket.IO + Prisma API  → deploy on Render (WebSockets)
packages/shared   Shared Zod schemas, types, constants
```

## Prerequisites

- Node.js 20+
- [Turso](https://turso.tech) database (libSQL) — or local SQLite for CLI only

## Setup

```bash
# From repo root
cp .env.example .env
# Set JWT_SECRET (min 32 chars) and TURSO_AUTH_TOKEN from:
#   turso db tokens create hivetalk

cp apps/web/.env.local.example apps/web/.env.local

npm install
npm run build -w @hivetalk/shared
npm run db:generate
npm run db:push          # local sqlite file for Prisma CLI
npm run db:push:turso    # apply schema to Turso (needs TURSO_* in .env)
```

## Develop

```bash
npm run dev
```

- Web: http://localhost:3000
- API / Socket.IO: http://localhost:4000
- Health: http://localhost:4000/health

## Deploy

### 1. Turso

1. Create DB (already done if you have a URL).
2. Create a token: `turso db tokens create hivetalk`
3. Put URL + token in `.env` / host env:
   - `TURSO_DATABASE_URL=libsql://hivetalk-rizwansar.aws-ap-south-1.turso.io`
   - `TURSO_AUTH_TOKEN=...`
4. Push schema: `npm run db:push:turso`

### 2. API on Render (required for Socket.IO)

Vercel cannot host long-lived WebSockets. Use Render Blueprint (`render.yaml`):

1. Push repo to GitHub
2. Render → New → Blueprint → select repo
3. Set env vars:
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   - `CLIENT_ORIGIN` = your Vercel URL (e.g. `https://hivetalk.vercel.app`)
   - `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`
   - `JWT_SECRET` (32+ chars)

### 3. Web on Vercel (monorepo picker)

If Vercel shows **two** directories (`apps/web` + `apps/server`):

1. Deploy **only `apps/web`**
2. **Skip / dismiss `apps/server`** on Vercel (deploy that on Render instead — see `DEPLOY.md`)
3. Root Directory: `apps/web`
4. Env vars:
   - `NEXT_PUBLIC_API_URL` = `https://<your-render-service>.onrender.com`
   - `NEXT_PUBLIC_WS_URL` = same as API URL

After both are live, set Render `CLIENT_ORIGIN` to the Vercel URL and redeploy the API.

Full checklist: [`DEPLOY.md`](./DEPLOY.md)

## Security defaults

- Helmet, CORS allowlist, rate limits on auth + API
- Zod validation on REST bodies and Socket.IO payloads (from `@hivetalk/shared`)
- JWT in httpOnly cookies (`SameSite=lax` locally; `none`+`Secure` cross-origin in prod)
- Channel/workspace membership checks before REST reads and socket join/send
- Passwords hashed with bcrypt (12 rounds)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run web + server + shared watch in parallel |
| `npm run build` | Build all packages |
| `npm run db:generate` | Prisma client generate |
| `npm run db:push` | Push schema to local SQLite |
| `npm run db:push:turso` | Apply schema SQL to Turso |
| `npm run db:migrate` | Create/apply local migrations |
