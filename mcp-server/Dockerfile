# MCP server image — the crawl / SEO-audit engine for the full-stack deploy.
# Build context MUST be the repo root (pnpm workspace; depends on packages/shared):
#   docker compose build mcp
# or:  docker build -f mcp-server/Dockerfile -t syntra-mcp .
#
# What it provides at runtime:
#   • crawl.plugin      → Playwright Chromium (headless)
#   • lighthouse.plugin → chrome-launcher, pointed at the same Chromium via CHROME_PATH
#   • repo/fs/shell     → git + a workspace dir on /data (only used by "Develop"→PR)
# The `claude` CLI (code-edit dispatch) is NOT installed here — it's only spawned
# when a user develops a suggestion into a PR. Add it later if you enable that flow.
FROM node:22-bookworm-slim

# git: repo plugin clones target repos. python3/make/g++: better-sqlite3-style
# native builds in shared deps. ca-certificates: TLS to Anthropic/Tavily/targets.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Whole workspace (.dockerignore strips node_modules/.next/.env/etc.).
COPY . .

# Install ONLY the mcp-server + its workspace deps (pulls @growth/shared,
# skips dashboard / demo-site).
RUN pnpm install --frozen-lockfile --filter @growth/mcp-server...

# tsc → dist/server.js
RUN pnpm --filter @growth/mcp-server build

# Download Playwright's Chromium AND the OS libraries it needs (fonts, nss,
# libatk, etc.). --with-deps runs apt-get for those system libs.
RUN pnpm --filter @growth/mcp-server exec playwright install --with-deps chromium

# Give chrome-launcher (Lighthouse) a stable path to the same Chromium binary.
# Playwright drops it under /root/.cache/ms-playwright/chromium-<rev>/chrome-linux/chrome.
RUN ln -sf "$(find /root/.cache/ms-playwright -type f -path '*chrome-linux*/chrome' | head -1)" \
        /usr/local/bin/chromium
ENV CHROME_PATH=/usr/local/bin/chromium

ENV NODE_ENV=production
ENV PORT=3100
# Persistent logs + per-run repo clones land here (compose mounts a volume).
ENV LOG_DIR=/data/logs
ENV WORKSPACE_ROOT=/data/workspaces

EXPOSE 3100
VOLUME ["/data"]

CMD ["node", "--enable-source-maps", "mcp-server/dist/server.js"]
