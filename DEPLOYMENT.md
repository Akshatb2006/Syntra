# Syntra — Deployment Guide

This guide covers deploying Syntra to production: the **MCP server**, the **dashboard**, and (optionally) the **demo site**.

> **Read this first — why Syntra is _not_ a one-click Vercel deploy.**
> The MCP server is a long-lived, stateful process that needs a real filesystem, `git`, a headless Chromium, and the ability to spawn the `claude` CLI as a subprocess. The dashboard uses **better-sqlite3** (a native module writing to a persistent file on disk) and runs a **background worker** that holds an open SSE connection to the MCP server. Neither fits a stateless/serverless model cleanly. **Deploy both on a VPS or container host with persistent disk** (Fly.io, Railway, Render, a Hetzner/DigitalOcean droplet, ECS with EBS, etc.). Vercel-specific caveats are noted at the end.

---

## 1. Architecture recap

```
                         ┌──────────────────────────────┐
  Browser ──HTTPS──▶     │  Dashboard (Next.js)  :3000  │
                         │   • Google OAuth + sessions  │
                         │   • SQLite (better-sqlite3)  │
                         │   • Worker subprocess (SSE)  │
                         └───────────────┬──────────────┘
                                         │ HTTP + SSE (Bearer auth)
                                         ▼
                         ┌──────────────────────────────┐
                         │  MCP Server (Express)  :3100 │
                         │   • Plugins: crawl, fs, repo,│
                         │     shell, lighthouse, seo,  │
                         │     github, vercel           │
                         │   • Spawns `claude` CLI      │
                         │   • Needs git + Chromium     │
                         └──────────────────────────────┘
```

- **Two processes must run simultaneously.** Dashboard → MCP over `MCP_BASE_URL`.
- **Node `>=20`** (your environment needs `node@22` — see `run-under-node22` memory; better-sqlite3 won't build on Node 26).
- **pnpm 9** workspace. Components: `dashboard/`, `mcp-server/`, `demo-site/`, `packages/shared/`.

---

## 2. Prerequisites on the host

Install on whatever box/container runs the apps:

```bash
# Node 22 + pnpm 9
nvm install 22 && nvm use 22
corepack enable && corepack prepare pnpm@9 --activate

# System deps the MCP server needs
#   - git           (repo plugin clones target repos)
#   - chromium deps (lighthouse / crawl via Playwright)
#   - claude CLI    (code dispatch shells out to it)
sudo apt-get update && sudo apt-get install -y git ca-certificates
npm i -g @anthropic-ai/claude-code     # provides the `claude` binary
```

Build the workspace once:

```bash
pnpm install --frozen-lockfile
pnpm --filter @growth/mcp-server build           # tsc → dist/server.js
pnpm --filter @growth/mcp-server install:browsers # playwright install chromium
pnpm --filter @growth/dashboard build            # next build
```

---

## 3. Deploy the MCP server

The MCP server is the harder piece — it is **stateful and privileged** (spawns subprocesses, writes to a workspace dir). Give it a persistent volume and lock it down.

### 3.1 Environment (`mcp-server/.env`)

```bash
PORT=3100
NODE_ENV=production
LOG_DIR=/data/logs
WORKSPACE_ROOT=/data/workspaces          # persistent disk; per-run repo clones land here

# Auth — comma-separated token:username pairs. Generate strong tokens!
VALID_TOKENS=tok_prod_<random>:syntra-dashboard

# Subprocess dispatch
CLAUDE_BIN=claude                        # or absolute path, e.g. /usr/local/bin/claude
DISPATCH_TIMEOUT_MS=900000               # 15 min

# Webhooks (only if you wire up GitHub/Vercel events)
GITHUB_WEBHOOK_SECRET=<random>
VERCEL_WEBHOOK_SECRET=<random>
GITHUB_TOKEN=<optional default; per-run tokens override>

PUBLIC_BASE_URL=https://mcp.yourdomain.com   # for log/display only
```

Generate tokens/secrets with `openssl rand -hex 32`.

### 3.2 Run it

```bash
node --enable-source-maps mcp-server/dist/server.js
# or: pnpm mcp:start
```

Keep it alive with a process manager (`systemd`, `pm2`) or as a container (see §6). Example systemd unit:

```ini
# /etc/systemd/system/syntra-mcp.service
[Unit]
Description=Syntra MCP Server
After=network.target

[Service]
WorkingDirectory=/opt/syntra/mcp-server
EnvironmentFile=/opt/syntra/mcp-server/.env
ExecStart=/usr/bin/node --enable-source-maps dist/server.js
Restart=always
User=syntra

[Install]
WantedBy=multi-user.target
```

### 3.3 Expose it (3 options)

The dashboard reaches the MCP server over HTTP. Pick based on where the dashboard runs:

1. **Same host / private network (recommended):** dashboard uses `MCP_BASE_URL=http://127.0.0.1:3100`. Don't expose 3100 publicly at all. Simplest and safest.
2. **Separate hosts:** put the MCP server behind a TLS reverse proxy (Caddy/nginx) at `https://mcp.yourdomain.com`, restrict by IP allowlist + Bearer token.
3. **Quick/temporary tunnel:** `pnpm tunnel` (`cloudflared tunnel --url http://localhost:3100`) — fine for demos, **not** for production.

> ⚠️ **Security:** the MCP server runs shell commands and clones repos. Never expose `:3100` to the open internet without TLS **and** Bearer auth **and** ideally IP allowlisting. Run it as an unprivileged user in an isolated container.

---

## 4. Deploy the dashboard

### 4.1 Environment (`dashboard/.env` or platform env vars)

```bash
# --- MCP connection ---
MCP_BASE_URL=http://127.0.0.1:3100         # or https://mcp.yourdomain.com
MCP_BEARER_TOKEN=tok_prod_<random>         # MUST match a token in MCP's VALID_TOKENS

# --- LLM ---
ANTHROPIC_API_KEY=sk-ant-...
ORCHESTRATOR_MODEL=claude-opus-4-7         # optional override
WORKER_MODEL=claude-sonnet-4-6             # optional override

# --- Data ---
SQLITE_PATH=/data/growth-engineer.db       # persistent, writable disk
SECRETS_ENC_KEY=<openssl rand -hex 32>     # encrypts stored creds at rest

# --- Auth (Google OAuth) ---
AUTH_URL=https://app.yourdomain.com        # public base URL of the dashboard
AUTH_SECRET=<openssl rand -hex 32>         # signs session cookies — REQUIRED in prod
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
# DEV_LOGIN=1                              # DEV ONLY — never set in prod

# --- Optional integrations ---
TAVILY_API_KEY=tvly-...                    # web search; stubs out if absent
OMIUM_API_URL=                             # tracing (optional)
OMIUM_API_KEY=
OMIUM_PROJECT_ID=growth-engineer
```

### 4.2 Google OAuth setup

In **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID**:

- **Authorized redirect URI:** `https://app.yourdomain.com/api/auth/callback/google`
  (must exactly match `${AUTH_URL}/api/auth/callback/google`)
- Add your prod domain to **Authorized JavaScript origins**.
- Copy the Client ID/Secret into the env vars above.

For local testing without Google, set `DEV_LOGIN=1` (see the `syntra-alpha-auth` memory).

### 4.3 Run the dashboard + worker

The dashboard needs **two** processes: the Next.js server and the background worker (keeps the MCP SSE subscriber alive).

```bash
# web
pnpm --filter @growth/dashboard start        # next start --port 3000

# worker (separate process / service)
pnpm --filter @growth/dashboard worker:start # tsx src/worker/start.ts
```

Front it with TLS (Caddy/nginx) terminating `https://app.yourdomain.com → 127.0.0.1:3000`.

### 4.4 Database notes

- SQLite schema auto-creates + self-migrates on first connection (idempotent `safeAlter`). **No manual migration step.**
- `SQLITE_PATH` must point to a **persistent, writable** location. WAL mode is on, so the directory must also allow `-wal`/`-shm` sidecar files.
- **Back it up** — it holds users, runs, suggestions, and encrypted secrets. A simple `sqlite3 db ".backup"` cron job works.

---

## 5. Deploy the demo site (optional)

Only needed if you want the live "intentionally broken" target site for agents to audit.

```bash
pnpm --filter @growth/demo-site build
pnpm --filter @growth/demo-site start   # next start --port 3200
```

Serve at `https://demo.yourdomain.com`. Skip entirely if you point Syntra at real external sites.

---

## 6. Containerized deploy (recommended shape)

No Dockerfile exists yet — here's a working pattern. Use a single image with two run targets, or two images.

**`mcp-server/Dockerfile`:**

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN npm i -g @anthropic-ai/claude-code
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @growth/mcp-server build \
 && pnpm --filter @growth/mcp-server install:browsers
# Playwright also needs OS libs; on slim images add:
RUN npx playwright install-deps chromium
ENV PORT=3100
EXPOSE 3100
VOLUME ["/data"]
CMD ["node", "--enable-source-maps", "mcp-server/dist/server.js"]
```

**`dashboard/Dockerfile`:**

```dockerfile
FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @growth/dashboard build
ENV PORT=3000
EXPOSE 3000
VOLUME ["/data"]          # holds growth-engineer.db
CMD ["pnpm", "--filter", "@growth/dashboard", "start"]
```

Run the worker as a second container/command from the same image:
`CMD ["pnpm","--filter","@growth/dashboard","worker:start"]`.

**`docker-compose.yml` sketch:**

```yaml
services:
  mcp:
    build: { context: ., dockerfile: mcp-server/Dockerfile }
    env_file: mcp-server/.env
    volumes: ["mcp-data:/data"]
    # no public ports — dashboard talks to it on the internal network
  dashboard:
    build: { context: ., dockerfile: dashboard/Dockerfile }
    env_file: dashboard/.env
    environment: { MCP_BASE_URL: "http://mcp:3100" }
    volumes: ["db-data:/data"]
    ports: ["3000:3000"]
    depends_on: [mcp]
  worker:
    build: { context: ., dockerfile: dashboard/Dockerfile }
    command: ["pnpm","--filter","@growth/dashboard","worker:start"]
    env_file: dashboard/.env
    environment: { MCP_BASE_URL: "http://mcp:3100" }
    volumes: ["db-data:/data"]
    depends_on: [mcp]
volumes: { mcp-data: {}, db-data: {} }
```

Put a TLS reverse proxy (Caddy/Traefik) in front of `dashboard:3000`.

---

## 7. Go-live checklist

- [ ] Node 22 on all hosts/images; `pnpm install --frozen-lockfile` succeeds.
- [ ] `mcp-server` built (`dist/server.js`) and Chromium installed (`install:browsers` + `playwright install-deps`).
- [ ] `claude` CLI present on the MCP host (`which claude`).
- [ ] **`MCP_BEARER_TOKEN` (dashboard) === a token in `VALID_TOKENS` (MCP).**
- [ ] MCP `:3100` **not** publicly exposed, or behind TLS + Bearer + IP allowlist.
- [ ] Persistent volumes mounted for `SQLITE_PATH` and `WORKSPACE_ROOT`/`LOG_DIR`.
- [ ] `AUTH_SECRET` and `SECRETS_ENC_KEY` set to strong random values (`openssl rand -hex 32`).
- [ ] Google OAuth redirect URI matches `${AUTH_URL}/api/auth/callback/google` exactly.
- [ ] `DEV_LOGIN` **unset** in production.
- [ ] `ANTHROPIC_API_KEY` set; model overrides valid.
- [ ] Both dashboard **and** worker processes running.
- [ ] SQLite backup cron in place.
- [ ] Smoke test: sign in via Google → start a run → confirm steps stream and a suggestion/PR appears.

---

## 8. Deploying the dashboard on Vercel (the 3-tier topology)

Putting the dashboard on Vercel is possible, but it does **not** remove the need for a persistent host — it just moves the UI off it. You end up with three tiers:

```
  Vercel (serverless)          Persistent host (VPS / Fly / Railway)     Managed
  ┌──────────────────┐         ┌─────────────────────────────┐      ┌──────────┐
  │ Next.js UI       │         │  Worker  ← runs pipelines    │      │ Postgres │
  │ API routes:      │─enqueue─│  MCP server (:3100)          │◀────▶│ (Neon /  │
  │  validate+write+ │ via DB  │  • git, Chromium, claude CLI │      │ Supabase)│
  │  stream events   │◀events──│                              │      └────┬─────┘
  └────────┬─────────┘ via DB  └──────────────┬──────────────┘           │
           └──────────────── shared state ────┴──────────────────────────┘
```

### Two reasons it isn't a lift-and-shift

1. **SQLite has no persistent disk on Vercel.** `better-sqlite3` writes to a local file; Vercel's FS is ephemeral and read-only at runtime. You must migrate to hosted Postgres (Neon/Supabase) or Turso/LibSQL.
2. **The pipeline runs fire-and-forget _in the request process_.** `dashboard/src/.../route.ts` writes the run, returns `202`, then runs `void runPipeline(run)` for *minutes*. On Vercel, **execution is frozen once the response is sent** — the pipeline would never finish. So the long work must move to the worker on a persistent host.

### What changes vs. the single-host deploy

| Concern | Single host (§3–4) | Dashboard on Vercel |
|---|---|---|
| Database | SQLite file on disk | **Hosted Postgres** — rewrite `client.ts` + the 7 repos under `infra/store/sqlite/` |
| Pipeline execution | In-process in the API route | **Moved to the worker** on a persistent host; API route only enqueues (writes a `queued` run) |
| Worker | Optional | **Mandatory**, runs where MCP runs, polls Postgres for queued runs |
| MCP reachability | `http://127.0.0.1:3100` (private) | **Public `https://mcp.yourdomain.com`** — Vercel calls it from the internet |
| Event streaming to browser | local eventBus | Stream from Postgres (poll run/step rows) — Vercel functions don't hold the MCP SSE socket |

### Deploying MCP for this topology

The MCP deploy is identical to **§3**, with two changes:

- **Expose it publicly over HTTPS.** TLS reverse proxy (Caddy/nginx) → `:3100`, at e.g. `mcp.yourdomain.com`. It can no longer be `127.0.0.1` because Vercel is remote.
- **Auth is your only perimeter.** Vercel egress IPs are dynamic, so IP allowlisting is impractical. Rely on the **Bearer token** (`MCP_BEARER_TOKEN` ↔ `VALID_TOKENS`) over TLS, and ideally add **Cloudflare Access with a service token** in front of `:3100` as a second layer. Run MCP as an unprivileged user in an isolated container — it executes shell commands.

### Vercel project settings (dashboard)

- **Root directory:** `dashboard` (it's a pnpm workspace — set Vercel's install command to run from the repo root or use `pnpm install` with workspace support).
- **Env vars:** everything from §4.1 **except** `SQLITE_PATH` (replace with your Postgres `DATABASE_URL`). `MCP_BASE_URL=https://mcp.yourdomain.com`. Set `AUTH_URL` to the Vercel domain and update the Google OAuth redirect URI to match.
- **`vercel.json`:** none exists yet — add one only if you need function `maxDuration` bumps; note even Pro caps function duration well under a full pipeline run, which is exactly why the pipeline must live on the worker, not in a route.

### Honest recommendation

If you're already standing up a persistent box for **MCP + worker**, hosting the dashboard there too (the §3–4 single-host path) avoids the Postgres migration *and* the queue/worker refactor. Vercel mainly buys you UI autoscaling and preview deploys. For alpha, single-host is materially less work; revisit Vercel once the SQLite→Postgres and enqueue-the-pipeline changes are done.

---

## 9. Quick reference — ports & commands

| Component | Port | Build | Start |
|-----------|------|-------|-------|
| MCP server | 3100 | `pnpm --filter @growth/mcp-server build` | `pnpm mcp:start` |
| Dashboard | 3000 | `pnpm --filter @growth/dashboard build` | `pnpm --filter @growth/dashboard start` |
| Dashboard worker | — | — | `pnpm --filter @growth/dashboard worker:start` |
| Demo site | 3200 | `pnpm --filter @growth/demo-site build` | `pnpm --filter @growth/demo-site start` |

---

## 10. Single-VM deploy — AWS EC2 + Docker (dashboard-only alpha)

The path for the gated alpha: **just the dashboard** (Google sign-in, onboarding,
viewing runs) on a single **AWS EC2** instance, via Docker Compose with Caddy for
automatic HTTPS. No MCP server, no worker, no LLM cost — the trial already locks
`/connect` and `/runs/new`, so no pipeline runs.

**Artifacts in this repo:** `dashboard/Dockerfile`, `docker-compose.yml`, `Caddyfile`,
`.dockerignore`, `.env.deploy.example`.

**Cost with $100 credits:** a `t3.small` (2 GB RAM) is ~$15/mo → ~6 months of runway.
The free-tier `t3.micro` (1 GB) also works **if you add a swap file** (§10.2) so the
Next.js build doesn't OOM. Credits cover the VM only — API keys bill separately.

### 10.1 Launch the EC2 instance
1. AWS Console → **EC2** → **Launch instance**.
2. **Name:** `syntra-alpha`.
3. **AMI:** Ubuntu Server 22.04 LTS (64-bit x86). *(For the cheaper arm64 `t4g.small`,
   pick the arm64 AMI — the image is multi-arch and builds natively either way.)*
4. **Instance type:** `t3.small` (recommended) or `t3.micro` (free-tier, needs swap).
5. **Key pair:** create one (e.g. `syntra-key`), download the `.pem`, keep it safe.
6. **Storage:** root volume **30 GB gp3**.
7. **Network settings → Edit → Security group** — add three inbound rules:

   | Type | Port | Source |
   |------|------|--------|
   | SSH   | 22  | My IP |
   | HTTP  | 80  | Anywhere `0.0.0.0/0` |
   | HTTPS | 443 | Anywhere `0.0.0.0/0` |

   80/443 **must** be public or Caddy can't get a Let's Encrypt cert.
8. **Launch instance.**
9. **Elastic IP (so the IP survives reboots):** EC2 → **Elastic IPs** → *Allocate*,
   then *Associate* it with the `syntra-alpha` instance. Note this IP.

### 10.2 SSH in + install Docker
```bash
chmod 400 syntra-key.pem
ssh -i syntra-key.pem ubuntu@<ELASTIC_IP>

# on the VM
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER && newgrp docker

# ONLY on t3.micro (1 GB) — 2 GB swap so the build doesn't OOM:
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 10.3 Domain (required for Google sign-in — free, no purchase)
Google OAuth won't accept a raw IP or `http`. Get a **free DuckDNS subdomain**:
1. Go to <https://www.duckdns.org>, sign in (GitHub/Google).
2. Create a subdomain, e.g. `syntra-alpha` → gives `syntra-alpha.duckdns.org`.
3. Set its **current ip** field to your Elastic IP and click **update ip**.

Caddy provisions the HTTPS cert automatically once DNS resolves and 80/443 are open.

### 10.4 Configure + deploy
```bash
git clone https://github.com/Akshatb2006/Syntra.git syntra && cd syntra
git checkout alpha

cp .env.deploy.example .env                 # set DOMAIN=syntra-alpha.duckdns.org
cp dashboard/.env.example dashboard/.env    # set AUTH_URL=https://$DOMAIN,
                                            # AUTH_SECRET + SECRETS_ENC_KEY
                                            # (openssl rand -hex 32 each)
docker compose up -d --build                # builds dashboard, starts it + Caddy
docker compose logs -f caddy                # watch for a successful cert
```
`AUTH_URL` must be exactly `https://` + the same `DOMAIN` in `./.env`. Visit
`https://$DOMAIN`. To smoke-test before Google is wired, set `DEV_LOGIN=1` in
`dashboard/.env`, `docker compose up -d`, sign in via the dev bypass, then remove it.

### 10.5 Wire Google (after the box is up — see §4.2)
Set the redirect URI to `https://$DOMAIN/api/auth/callback/google` and add
`https://$DOMAIN` to Authorized JavaScript origins, put the client id/secret in
`dashboard/.env`, then `docker compose up -d` to reload.

### 10.6 Operate
- **Data** lives in the `db-data` volume (`/data/growth-engineer.db`). Back it up:
  `docker compose exec dashboard sh -c 'cp /data/growth-engineer.db /data/backup-$(date +%F).db'` (or a host cron over the volume).
- **Update:** `git pull && docker compose up -d --build`.
- **arm64 note (`t4g` instances):** `better-sqlite3` builds in-image; the Dockerfile
  includes `python3/make/g++` as a compile fallback if no prebuilt binary matches.
