# Autonomous Growth Engineer

> Multi-agent autonomous SEO/growth pipeline for real-estate Next.js websites.
> A run = audit → research → plan → modify (via Claude Code over MCP) → preview
> deploy → validate, all unattended, with a verifiable trace tree.

## What this is

A two-process system designed for collaboration across two laptops:

```
┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
│ YOUR LAPTOP                          │         │ FRIEND'S LAPTOP                      │
│                                      │         │                                      │
│  mcp-server  (Express + MCP SDK)     │ <─────  │  dashboard  (Next.js 15 + agents)    │
│   /mcp        (MCP tools)            │  HTTP   │   ports/adapters core                │
│   /dispatch   (Claude Code subprocess)│  +SSE  │   5 agents (Opus/Sonnet)             │
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
    app/                     pages + API routes
    core/                    framework-free domain (entities + ports)
      ports/                 Tracer, LLM, MCP, Store, Search, EventBus
    agents/                  Orchestrator, Crawl/SEO, Geo Intel, Code Mod, Validation
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

- Node 20+ and `pnpm`
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

Run flow:

1. `/connect` — verifies MCP reachability, collects credentials, returns a credentialsRef.
2. `/runs/new` — site URL + GitHub repo URL + optional primary city.
3. `/runs/[id]` — live agent timeline, trace tree, suggestions. When the PR
   opens and the Vercel preview is ready, the Validation agent re-runs
   Lighthouse and the before/after delta appears.

### Step 3 — demo target

If you don't have a real-estate Next.js repo:

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
| Multi-agent | 5 distinct agents with separated responsibilities, prompts, models, and tool surfaces. |
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

## Reference vs new MCP

The folder `reference/apartmenthub-mcp/` is a working MCP server from another
project (ApartmentHub). It is **pattern source only** — the new `mcp-server/`
in this repo is built from scratch and is generic (per-run workspaces, any
GitHub repo). Do not extend the reference; treat it as documentation.
