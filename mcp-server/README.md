# mcp-server

MCP server for the Autonomous Growth Engineer. Runs on the user's laptop. Exposes:

- `/mcp` — MCP protocol tools (repo, fs, shell, lighthouse, crawl, seo, vercel, github)
- `/dispatch/code-edit` — generic Claude Code subprocess endpoint that applies one suggestion on a feature branch and opens a PR
- `/webhooks/github`, `/webhooks/vercel` — webhook ingress (signature-verified)
- `/events` — SSE stream the dashboard subscribes to for live updates
- `/health`

## Run

```bash
pnpm install
cp .env.example .env  # edit VALID_TOKENS etc.
pnpm install:browsers
pnpm dev               # or: pnpm build && pnpm start
```

Expose publicly via Cloudflare Tunnel from the repo root:

```bash
pnpm tunnel
```

## Auth

Set `VALID_TOKENS=tok_a:userA,tok_b:userB`. Clients send `Authorization: Bearer tok_a`.
