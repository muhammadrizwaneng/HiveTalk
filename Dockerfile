# HiveTalk API (Express + Socket.IO) for Fly.io
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @hivetalk/shared \
  && npm run db:generate -w @hivetalk/server \
  && npm run build -w @hivetalk/server

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server ./apps/server
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@hivetalk/server"]
