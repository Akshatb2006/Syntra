# Dashboard-only image for the gated alpha (no MCP server, no worker).
# Build context MUST be the repo root — this is a pnpm workspace and the
# dashboard depends on packages/shared. Build it with:
#   docker compose build      (compose sets context: . for you)
# or:
#   docker build -f dashboard/Dockerfile -t syntra-dashboard .
FROM node:22-bookworm-slim

# Toolchain so better-sqlite3 can compile from source if no prebuilt binary
# matches the platform (Oracle's free tier is arm64 — prebuilts usually exist,
# this is just a safety net). Removed from the final layer to keep size down.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy the whole workspace (.dockerignore strips node_modules/.next/.env/etc.).
COPY . .

# Install ONLY the dashboard and its workspace deps. The `...` suffix pulls in
# @growth/shared but skips mcp-server / demo-site, so no Playwright/Chromium
# download — much smaller, much faster.
RUN pnpm install --frozen-lockfile --filter @growth/dashboard...

# Compile Next.js. force-dynamic pages mean no DB is touched at build time.
RUN pnpm --filter @growth/dashboard build

ENV NODE_ENV=production
ENV PORT=3000
# Default DB location — overridden by compose to land on the mounted volume.
ENV SQLITE_PATH=/data/growth-engineer.db

EXPOSE 3000
VOLUME ["/data"]

# `next start --port 3000` (the package's start script). Caddy proxies to this.
CMD ["pnpm", "--filter", "@growth/dashboard", "start"]
