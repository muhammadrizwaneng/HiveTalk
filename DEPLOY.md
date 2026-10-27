# HiveTalk deploy (monorepo)

Your repo has **two** apps. They are **not** both meant for Vercel.

| App | Platform | Why |
|-----|----------|-----|
| `apps/web` | **Vercel** | Next.js — perfect fit |
| `apps/server` | **Render** (or Railway/Fly) | Express + **Socket.IO** need a real Node process. Vercel serverless cannot keep WebSocket chat alive. |

Turso is the shared database for the API (not for the Next.js app).

---

## Vercel modal (“Detected 2 deployable directories”)

1. Open **`apps/web`** → continue / deploy that one.
2. For **`apps/server`**: **Dismiss** / skip — do **not** import it as a Vercel project.
3. In the web project settings:
   - **Root Directory:** `apps/web`
   - Install / build are already in `apps/web/vercel.json`
4. Env vars on the **web** project:

```text
NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com
NEXT_PUBLIC_WS_URL=https://YOUR-API.onrender.com
```

---

## API on Render (required for live chat)

1. [Render](https://dashboard.render.com) → **New** → **Blueprint** → this GitHub repo (`render.yaml`).
2. Set env:

```text
TURSO_DATABASE_URL=libsql://hivetalk-rizwansar.aws-ap-south-1.turso.io
TURSO_AUTH_TOKEN=<from turso db tokens create hivetalk>
CLIENT_ORIGIN=https://YOUR-APP.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
JWT_SECRET=<32+ random chars>
DATABASE_URL=file:./prisma/dev.db
NODE_ENV=production
```

3. After both URLs exist:
   - Put Render URL into Vercel `NEXT_PUBLIC_*` vars
   - Put Vercel URL into Render `CLIENT_ORIGIN`
   - Redeploy both

4. Push schema to Turso (once):

```bash
# local, with TURSO_* in .env
npm run db:push:turso
```

---

## Why not both on Vercel?

Selecting both directories in the monorepo UI only creates **two Vercel projects**. The Express + Socket.IO server will deploy as serverless and **realtime messaging will fail**. Use Render for `apps/server`.
