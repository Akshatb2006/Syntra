# dashboard

Next.js 15 dashboard for Syntra. Runs on the friend's
laptop. Contains:

- 5 agents (Orchestrator, Crawl/SEO, Geo Intel, Code Mod, Validation)
- Orchestration pipeline (long-running, in-process)
- SQLite persistence (runs, agent_steps, trace_spans, suggestions, secrets)
- Composite tracer (Console + SQLite + Omium adapter)
- MCP HTTP client + Anthropic LLM client + Tavily search client
- SSE-driven live UI

## Run

```bash
pnpm install
cp .env.example .env   # set ANTHROPIC_API_KEY, MCP_BASE_URL, MCP_BEARER_TOKEN
pnpm dev               # http://localhost:3000
```

## Flow

1. `/connect` — verify MCP reachability, save credentials.
2. `/runs/new` — enter site URL + repo URL.
3. `/runs/[id]` — live agent timeline, trace tree, suggestions, PR + preview
   links, before/after Lighthouse delta.
