# Syntra: Autonomous Growth Engineer

> Multi-agent autonomous SEO/growth pipeline for Next.js websites in **any
> industry**. A run = audit → research → plan → modify (via Claude Code over
> MCP) → preview deploy → validate, all unattended, with a verifiable trace
> tree. (A deliberately-broken real-estate site, Bangalore Homes, ships as the
> demo target.)

## Problem Statement

Most websites struggle to maintain organic visibility because SEO is a manual, tedious, continuous process. Technical audits, keyword and search-demand research, content planning, and actual code implementation require specialized knowledge and significant developer time — so sites fall behind best practices and lose traffic to better-optimized competitors. This holds across industries: a local real-estate agency, a SaaS product, a clinic, and an e-commerce store all face the same grind.

## Our Solution

Syntra automates the entire SEO lifecycle using a multi-agent system. It first **detects what kind of business a site is**, then runs an autonomous pipeline that:
1. **Audits** the site using Lighthouse and custom crawlers.
2. **Researches** keywords, search demand, and competitor coverage in real time.
3. **Plans** technical and content improvements, ranked by opportunity.
4. **Modifies** the codebase autonomously (opening PRs via Claude Code).
5. **Validates** the changes against preview deployments.

By coordinating specialized, business-aware AI agents, Syntra acts as an always-on growth engineer for a Next.js site in any industry — continuously improving its search ranking and user experience with zero manual intervention.

## What this is

A two-process system designed for collaboration across two laptops:

```
┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
│ YOUR LAPTOP                          │         │ FRIEND'S LAPTOP                      │
│                                      │         │                                      │
│  mcp-server  (Express + MCP SDK)     │ <─────  │  dashboard  (Next.js 15 + agents)    │
│   /mcp        (MCP tools)            │  HTTP   │   ports/adapters core                │
│   /dispatch   (Claude Code subprocess)│  +SSE  │   10 agents (Opus/Sonnet/Haiku)      │
│   /webhooks   (GitHub + Vercel)      │         │   SQLite store                       │
│   /events     (SSE event bus)        │         │   Composite tracer (Console+SQLite   │
│                                      │         │     +Omium)                          │
│                                      │         │   Webhook-driven re-audits           │
│  exposed via `cloudflared tunnel`    │         │                                      │
└──────────────────────────────────────┘         └──────────────────────────────────────┘
```

End-user supplies: GitHub repo URL, GitHub token, Vercel token, GA4/Search Console keys.
The dashboard collects them, the agents use them per-run, the platform stores
them encrypted at rest.

## Layout

```
mcp-server/                  TypeScript MCP server (your laptop)
  src/
    server.ts                entry
    config.ts                env loading + validation
    auth/                    bearer middleware
    transport/               express + MCP setup
    plugins/                 repo, fs, shell, lighthouse, crawl, seo, vercel, github
    dispatch/                Claude Code subprocess + job tracking + prompt builder
    webhooks/                github + vercel signature verify + handlers
    events/                  in-memory bus
    workspace/               per-run workspace dir manager
    routes/                  health, mcp, dispatch, webhook, events
    lib/                     logger, errors, trace-context

dashboard/                   Next.js 15 + Tailwind v4 (friend's laptop)
  src/
    app/                     pages (landing + auth + onboarding) + API routes
    core/                    framework-free domain (entities + ports)
      ports/                 Tracer, LLM, MCP, Store, Search, EventBus
    agents/                  Orchestrator, Crawl/SEO, Site Understanding, Geo Intel,
                             Demand Intel, Competitor Intel, Enrichment, Blueprint,
                             Code Mod, Validation
    lib/auth/                Google OAuth, signed sessions, per-user guard
    infra/                   port implementations
      tracer/                Console + SQLite + Omium + Composite
      llm/                   Anthropic SDK
      mcp/                   typed MCP HTTP client
      store/sqlite/          repositories + schema
      search/                Tavily + stub
      eventbus/              local bus + MCP SSE subscriber
    orchestration/           pipeline + job runner + trace context
    ui/                      components + hooks
    lib/                     env, logger, crypto

demo-site/                   Bangalore Homes — deliberately broken Next.js site
                             (the agent's demo target)

packages/shared/             types, zod schemas, constants used by both ends

reference/apartmenthub-mcp/  pattern source only (do not extend)
```

## Quickstart

### Prereqs (both laptops)

- **Node 22 (LTS)** and `pnpm` — pin to 22; `better-sqlite3`'s native build does
  not yet support Node 26 (`brew install node@22`, or `nvm use 22`)
- `claude` (Claude Code CLI) — `your laptop only`, used by the dispatcher
- `cloudflared` — your laptop, to expose the MCP server

### Step 1 — your laptop (MCP server)

```bash
pnpm install
cd mcp-server
cp .env.example .env
# edit .env: set VALID_TOKENS=tok_you:you,tok_friend:friend
# set GITHUB_WEBHOOK_SECRET and VERCEL_WEBHOOK_SECRET if you wire webhooks
pnpm install:browsers   # one-time: installs Chromium for crawl + Lighthouse
cd ..
pnpm mcp:dev            # starts MCP at http://localhost:3100
```

In a second terminal:

```bash
pnpm tunnel             # cloudflared tunnel --url http://localhost:3100
                        # copy the printed https URL
```

### Step 2 — friend's laptop (dashboard)

```bash
pnpm install
cd dashboard
cp .env.example .env
# Required for the dashboard operator:
#   MCP_BASE_URL=https://<tunnel-url>
#   MCP_BEARER_TOKEN=tok_friend       (matches VALID_TOKENS on the MCP)
# Auth (sign-in gate on the landing page):
#   AUTH_URL=http://localhost:3000       (base URL; used to build the OAuth redirect)
#   AUTH_SECRET=<openssl rand -hex 32>   (HMAC key for signed session cookies)
#   GOOGLE_CLIENT_ID=…, GOOGLE_CLIENT_SECRET=…   (Google OAuth client)
#   DEV_LOGIN=1                          (local-only bypass — MUST be unset in prod)
# Optional platform-wide fallbacks (otherwise each user supplies via /connect):
#   ANTHROPIC_API_KEY=sk-…
#   TAVILY_API_KEY=tvly-…
#   OMIUM_API_URL=…, OMIUM_API_KEY=…
#   SECRETS_ENC_KEY=<openssl rand -hex 32>
cd ..
pnpm dashboard:dev      # http://localhost:3000
```

The platform provides the LLM and search infrastructure. The only thing a user
needs to supply via `/connect` is a **GitHub PAT** — Claude needs it to push
branches and open PRs on their repo.

The `/connect` form collects:

- **Required: GitHub PAT** (`repo` + `workflow` scopes on the target repo) — the
  agents push branches and open PRs using this token.
- **Recommended: Vercel token + project ID** — unlocks the Validation agent's
  before/after Lighthouse delta on the preview deployment.
- **Optional: Google Places, GA4 property ID, Search Console site URL** —
  captured for future integrations.

Credentials are encrypted at rest (AES-256-GCM, keyed by `SECRETS_ENC_KEY`)
and referenced from each run by an opaque credentialsRef.

### Authentication & access

The dashboard opens on a branded landing page at `/`. Signed-out visitors see it
behind a blur gate; **Google sign-in** is the only way in (zero-dependency
OAuth + HMAC-signed session cookies via Web Crypto). First sign-in routes
through a short `/onboarding` step. Every run is **isolated per user** — you only
ever see your own runs.

For local development without Google credentials, set `DEV_LOGIN=1` to enable a
bypass: the landing page shows a "Skip — continue without Google" button (and
`/api/auth/dev?email=you@test.com` signs in as any email, so you can test
per-user isolation). The bypass route hard-404s unless `DEV_LOGIN` is set —
**keep it unset in production.**

Run flow:

1. **Sign in** at `/` (Google, or the dev bypass) → first time, complete `/onboarding`.
2. **Hero audit box** — paste a URL on the landing page for an audit-only run
   (no credentials needed); it drops you straight onto the live results page.
3. `/connect` — when you choose to implement a fix, verify MCP reachability and
   add a GitHub PAT (returns a credentialsRef).
4. `/runs/[id]` — live agent timeline, trace tree, suggestions. When the PR
   opens and the Vercel preview is ready, the Validation agent re-runs
   Lighthouse and the before/after delta appears.

### Step 3 — demo target

If you don't have a Next.js repo to point at (any industry works):

```bash
cd demo-site
pnpm dev                # http://localhost:3200
# push to GitHub:
git init && git add -A && git commit -m "demo target"
gh repo create bangalore-homes-demo --public --source=. --push
```

Connect that repo to a fresh Vercel project. Use it as the `repoUrl` in the dashboard.

## Webhooks (optional but recommended)

On the demo repo settings → Webhooks:

- Payload URL: `https://<tunnel>/webhooks/github`
- Content type: `application/json`
- Secret: matches `GITHUB_WEBHOOK_SECRET`
- Events: just `push`

On Vercel project → Webhooks:

- URL: `https://<tunnel>/webhooks/vercel`
- Secret: matches `VERCEL_WEBHOOK_SECRET`

Now every push (or every deploy) becomes an autonomous re-audit trigger.

## Omium tracing (optional bonus)

Set `OMIUM_API_URL` and `OMIUM_API_KEY` in the dashboard's `.env`. The
CompositeTracer's OmiumTracer instance becomes active and ships every span
(agent invocations, tool calls, LLM calls, MCP requests, async dispatches,
webhook receipts) to your project on the Omium dashboard. The wire format is
a forward-looking adapter — confirm the exact endpoint against Omium docs at
integration time and adjust `OmiumTransport.flush()` if needed.

## Six axes — how this satisfies the brief

| Axis | How |
|---|---|
| Multi-agent | 10 distinct, business-aware agents with separated responsibilities, prompts, models (Opus/Sonnet/Haiku), and tool surfaces. |
| Autonomy | A single click runs audit → research → plan → modify (Claude Code) → wait for preview → validate, with retries baked in. |
| Long-running | Pipeline can run for ~15min per Claude Code dispatch; SSE event stream keeps the UI live; SQLite survives restarts. |
| Tool calling | MCP exposes 12+ tools; agents call them via a typed HTTP client. |
| Web search | Geo Intel agent uses Tavily for locality keyword discovery. |
| Webhooks | GitHub push + Vercel deploy webhooks ingest into MCP; events flow through SSE into the dashboard. |
| Async orchestration | `/dispatch/code-edit` is fire-and-forget; orchestrator polls; UI updates via SSE. |
| Real side effects | Real PR opened by `gh`, real Vercel preview, real Lighthouse delta. |
| Observability | Composite tracer renders the same workflow into Console logs, SQLite-backed Trace Tree in the dashboard, and (optionally) Omium. |

## Architecture decisions

- **Hexagonal/Ports & Adapters** — `core/ports/*` defines what the domain needs;
  `infra/*` provides implementations. Agents only depend on ports, so they're
  unit-testable and we could swap LLM/search/storage without touching them.
- **SQLite via better-sqlite3** — no Docker, no Redis. Hackathon-safe, demo-safe.
- **In-process job execution + SSE** — simpler than BullMQ for a single-laptop demo.
  Pipeline state survives Node restarts via SQLite; events are buffered for
  late SSE subscribers.
- **Claude Code as the code-modification engine** — wrapped via `claude -p` in a
  per-run workspace, scope-guarded by an in-prompt rule set (never touch `.env`,
  never push to main, never modify more than 6 files per suggestion).
- **Composite tracing** — `SqliteTracer` owns ID generation so the trace tree is
  always renderable locally even if Omium is unreachable; `OmiumTracer` is a
  best-effort batched HTTP shipper.

