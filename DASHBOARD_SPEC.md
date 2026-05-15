# Autonomous Growth Engineer — Dashboard Spec

This document is a self-contained brief you can hand to a UI-design model
(Claude.ai, v0, Lovable, etc.) and get back a coherent dashboard. It captures
every screen, data shape, real-time event, and visual rule that the dashboard
must respect. Read it top-to-bottom before generating anything.

---

## 1. What this product is

A multi-agent autonomous **SEO / growth pipeline** for real-estate Next.js
websites. A single **Run** does:

1. **Crawl + SEO audit** the user's live site
2. **Geo intelligence** (locality + landmark + intent discovery for the target city)
3. **Plan** a set of high-impact, low-risk suggestions
4. **Modify** the user's repo via Claude Code over MCP (one PR per accepted suggestion)
5. Wait for **Vercel preview** to deploy
6. **Validate** with a re-run of Lighthouse against the preview

The dashboard is the human surface for: configuring a run, watching it
execute live, reviewing suggestions, accepting/rejecting them, and inspecting
the trace tree of what every agent did.

Audience: a single power-user (the dev) running it on their own site. Not
multi-tenant. Not B2B. One operator, one site at a time, deeply observable.

---

## 2. Top user tasks (in order of frequency)

1. **Watch a run execute live** — see which agent is working, which step is
   running, what spans are open, the current log line.
2. **Review and accept/reject suggestions** the planning agent proposed.
3. **Trigger a new run** by pasting a site URL + repo URL.
4. **Configure credentials** (GitHub token, Vercel token, optional GA4/Search Console).
5. **Inspect a finished run** — see Lighthouse delta, PR link, what changed.
6. **Debug a failed run** — drill into the trace tree, find the failing span,
   read the error.

The dashboard should optimize for **task 1** above all. Live execution must
feel like watching an agent breathe — not like refreshing a status page.

---

## 3. Information architecture

```
/                       Runs index (home)
/runs/new               New run wizard
/runs/[id]              Run detail (the centerpiece — live execution view)
/connect                Credentials + integration setup
/status                 System health (MCP reachable, Omium configured, etc.)
/settings               (optional) global preferences
```

Top nav: **Runs · New Run · Connect · Status**. Compact. No multi-level menus.

---

## 4. Page-by-page spec

### 4.1 Home — Runs index (`/`)

**Purpose:** see all runs, click into any, start a new one.

Layout (top to bottom):

- **Header strip**: title "Runs", subtitle with run count, primary CTA
  "New Run" on the right.
- **Filters row** (chips): All · Running · Completed · Failed · Today · Last 7d.
- **Runs table** (one row per run, newest first):
  - Status pill (color-coded — see §7)
  - Site URL (truncated, with copy icon on hover)
  - Repo (org/name)
  - City
  - Trigger badge (manual / webhook / scheduled)
  - Duration (or live-elapsed clock if running)
  - PR link (if any)
  - Lighthouse delta strip (4 mini-bars: perf, a11y, best, seo) — only if completed
  - Created (relative time)
- Empty state: large card with "Start your first run" CTA and a tiny diagram
  of the 5-agent pipeline.

A running row should have a soft pulse animation on the status pill and a
live-updating duration. Use SSE (see §6) to push updates without polling.

### 4.2 New Run wizard (`/runs/new`)

**Purpose:** kick off a run in under 30 seconds.

Single-page, three blocks stacked:

1. **Target** — Site URL (https://...), Repo URL (github.com/org/name),
   Branch base (default `main`), City (optional — autofills from URL).
2. **Credentials** — shows status of saved credentials (a green check + last 4
   of the GitHub token), with a "Manage credentials" link to `/connect` if
   anything is missing.
3. **Pre-flight checks**:
   - MCP server reachable? (green/red dot)
   - GitHub token has push access to the repo? (green/red)
   - Vercel project linked? (green/yellow if missing — optional)
4. **Start run** primary button (disabled until target + credentials valid).
   Show a 1-line preview of what will happen: "Audit → plan → dispatch up to
   5 PRs → preview deploy → validate."

After click: optimistic redirect to `/runs/[id]` with a "queued" skeleton.

### 4.3 Run detail (`/runs/[id]`) — the centerpiece

**This is where 80% of UI value lives.** Treat it like a flight-deck.

Layout: **three-pane**, full viewport, dark.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ HEADER:  site URL · repo · status pill · live duration · PR · preview · ✕ │
├────────────────────┬──────────────────────────────┬──────────────────────┤
│ LEFT (260px)       │ CENTER (flex)                │ RIGHT (360px)        │
│                    │                              │                      │
│ Pipeline stepper   │ Tab strip:                   │ Live log feed        │
│  ● Crawl   3.2s    │  Timeline · Trace · Sug-     │  (scrolling, newest  │
│  ● Research ...    │   gestions · Lighthouse · PR │   at bottom, pause   │
│  ◐ Plan (running)  │                              │   on scroll-up)      │
│  ○ Modify          │ The active tab fills the     │                      │
│  ○ Validate        │ middle column.               │ Filter: info/warn/   │
│                    │                              │ error  ·  agent ▾    │
│ Suggestions count  │                              │                      │
│  proposed: 7       │                              │                      │
│  accepted: 3       │                              │                      │
│  dispatched: 2     │                              │                      │
│  validated: 1      │                              │                      │
│                    │                              │                      │
│ Quick links:       │                              │                      │
│  Workspace folder  │                              │                      │
│  Open PR           │                              │                      │
│  Preview deploy    │                              │                      │
└────────────────────┴──────────────────────────────┴──────────────────────┘
```

**Tabs in the center column:**

#### Tab A: Timeline (default)
Vertical timeline of `AgentStep` records. Each step:
- Agent icon + name (orchestrator / crawl_seo / geo_intel / code_mod / validation)
- Title ("Crawled 47 pages", "Generated 12 suggestions", etc.)
- Status (pending → running → completed/failed/skipped) with spinner if running
- Duration
- Expandable to show input/output JSON (collapsed by default)

Nested steps indent (parentStepId).

#### Tab B: Trace
Trace tree (collapsible) of `TraceSpan` records. Each span:
- Kind (agent / llm / mcp_tool / dispatch / shell / lighthouse)
- Name
- Status dot (ok/error/unset)
- Duration bar (relative to root span, visual width)
- Click → side drawer with attributes, events, error stack

Top of tab: a horizontal time-strip showing all spans on a shared timeline
(Gantt-style), with current "now" marker pulsing if the run is active.

#### Tab C: Suggestions
List of `Suggestion` records grouped by status:

- **Proposed** (default expanded) — title, category badge, impact (low/med/high)
  + risk badge, priority score (0-100 bar), expandable rationale and target
  files. Each row has **Accept** (primary) and **Reject** buttons. Selecting
  a suggestion dispatches it to Claude Code (over MCP) and creates a PR.
- **In flight** — dispatched but not yet PR'd. Show "Dispatching..." with
  the Claude Code job ID and a live log preview.
- **Implemented** — PR created. Show PR number/link, files changed,
  "Validating..." or final delta.
- **Rejected / Failed** — collapsed by default.

Bulk-action bar at top: "Accept all high-impact, low-risk" shortcut.

#### Tab D: Lighthouse
Two side-by-side score cards: **Baseline** (before run) and **After** (preview).
Each card has the 4 metrics (perf, a11y, best-practices, seo) as donut gauges
0-100, color-graded (red < 50, amber 50-89, green 90+). Below each card, a
small breakdown of which audits changed (improvements in green, regressions
in red). If still in progress, show a placeholder + ETA.

#### Tab E: PR
Embedded summary of every PR this run opened:
- PR number + title + GitHub link
- Suggestion it came from
- Files changed (with line counts)
- Status (open / merged / closed)
- CI status (if available)

**Header behavior:**
- Status pill animates on transition (queued → crawling → ... → completed).
- Duration is live (HH:MM:SS).
- "✕ Cancel" only enabled if `status ∈ {queued, crawling, researching, planning}`.

### 4.4 Connect (`/connect`)

Single-page credential vault. Three groups:

1. **Required**
   - GitHub Personal Access Token (with `repo` scope) — masked input,
     "Test" button that hits GitHub `/user`.
2. **Recommended**
   - Vercel Token + Project ID + Team ID (so the Validation agent can
     re-Lighthouse the preview deployment).
3. **Optional / future**
   - Google Places API key
   - GA4 Property ID
   - Search Console Site URL

Each field has a "Test" button. On test success, show a green pill with the
identity ("Connected as @username", "Project: realtor-site"). Save button
encrypts and persists; the response is a `credentialsRef` token the New Run
wizard uses.

### 4.5 Status (`/status`)

System observability page. Four "service" cards in a 2x2 grid:

- **MCP server** — URL, reachable Y/N, list of loaded plugins
  (repo · fs · shell · lighthouse · crawl · seo · vercel · github), user
  count, latency.
- **Omium tracing** — configured, project ID, last successful flush.
- **Anthropic** — API key configured, last call latency.
- **Tavily search** — configured / fallback.

Below: recent platform events feed (auto-scrolling).

---

## 5. Domain entities (data shapes the UI will render)

```ts
type RunStatus =
  | "queued" | "crawling" | "researching" | "planning"
  | "awaiting_dispatch" | "modifying" | "awaiting_preview"
  | "validating" | "completed" | "failed" | "cancelled";

interface Run {
  id: string;                     // "run_<hex>"
  input: {
    siteUrl: string;
    repoUrl: string;
    branchBase?: string;
    city?: string;
    trigger:
      | { kind: "manual"; userId: string }
      | { kind: "github_webhook"; deliveryId: string; commit: string }
      | { kind: "vercel_webhook"; deploymentId: string }
      | { kind: "scheduled"; cron: string };
  };
  status: RunStatus;
  credentialsRef: string;
  workspaceId: string;
  prUrl: string | null;
  previewUrl: string | null;
  baselineLighthouse: LighthouseSummary | null;
  afterLighthouse: LighthouseSummary | null;
  error: { message: string; stack?: string } | null;
  createdAt: number;              // epoch ms
  updatedAt: number;
  completedAt: number | null;
}

interface LighthouseSummary {
  url: string;
  performance: number;            // 0-100
  accessibility: number;
  bestPractices: number;
  seo: number;
  fetchedAt: number;
}

type AgentName =
  | "orchestrator" | "crawl_seo" | "geo_intel" | "code_mod" | "validation";

interface AgentStep {
  id: string;
  runId: string;
  agent: AgentName;
  parentStepId: string | null;
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  input: unknown;
  output: unknown;
  error: { message: string; stack?: string } | null;
  metadata: Record<string, unknown>;
}

interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  runId: string | null;
  kind: "agent" | "llm" | "mcp_tool" | "dispatch" | "shell" | "lighthouse";
  name: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  status: "ok" | "error" | "unset";
  attributes: Record<string, unknown>;
  events: Array<{ ts: number; name: string; attributes?: Record<string, unknown> }>;
  error: { message: string; stack?: string } | null;
}

type SuggestionCategory =
  | "metadata" | "schema" | "internal_linking" | "locality_page"
  | "performance" | "image_optimization" | "content_quality"
  | "accessibility" | "structured_data" | "sitemap_robots";

interface Suggestion {
  id: string;
  runId: string;
  category: SuggestionCategory;
  title: string;
  description: string;
  rationale: string;
  expectedImpact: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  priorityScore: number;          // 0-100
  targetFiles: string[];
  geoContext?: {
    locality: string;
    city: string;
    landmarks: string[];
    searchIntents: string[];
    keywordCluster: string[];
  };
  status:
    | "proposed" | "selected" | "dispatched"
    | "implemented" | "validated" | "rejected" | "failed";
  dispatchJobId: string | null;
  prNumber: number | null;
}
```

---

## 6. Real-time event taxonomy (SSE — what the UI subscribes to)

`/api/runs/[id]/events` returns an SSE stream of `PlatformEvent` envelopes:

```ts
type PlatformEvent =
  | { type: "run.created"; runId: string; at: number }
  | { type: "run.status_changed"; runId: string; status: RunStatus; at: number }
  | { type: "run.completed"; runId: string; prUrl: string | null; at: number }
  | { type: "run.failed"; runId: string; error: string; at: number }
  | { type: "agent.step_started"; runId: string; agent: AgentName; stepId: string; title: string; at: number }
  | { type: "agent.step_progress"; runId: string; stepId: string; message: string; at: number }
  | { type: "agent.step_finished"; runId: string; stepId: string; status: AgentStepStatus; at: number }
  | { type: "trace.span_started"; runId: string | null; span: { traceId; spanId; parentSpanId; kind; name; startTime } }
  | { type: "trace.span_finished"; runId: string | null; spanId: string; status: "ok"|"error"|"unset"; endTime: number }
  | { type: "suggestion.proposed"; runId: string; suggestion: Suggestion }
  | { type: "suggestion.selected"; runId: string; suggestionId: string }
  | { type: "dispatch.started"; runId: string; jobId: string; suggestionId: string; at: number }
  | { type: "dispatch.completed"; runId: string; jobStatus: DispatchJobStatus }
  | { type: "webhook.received"; source: "github"|"vercel"; eventType: string; runId: string|null; at: number }
  | { type: "preview.ready"; runId: string; previewUrl: string; at: number }
  | { type: "log"; runId: string|null; level: "info"|"warn"|"error"; message: string; at: number };
```

**UI rule:** the Run detail page must show new content within ~500ms of an
event arriving. No "refresh to see latest". The log feed is append-only and
auto-scrolls unless the user has scrolled up (then show a "↓ new logs" pill).

---

## 7. Visual design system

**This is the existing palette — keep it consistent.**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0a0b` | page background |
| `--bg-elev` | `#131316` | cards, surfaces |
| `--border` | `#26262b` | dividers, borders |
| `--fg` | `#e7e7ea` | primary text |
| `--fg-muted` | `#9b9ba3` | secondary text |
| `--accent` | `#5eead4` | primary actions, active states (teal) |
| `--accent-fg` | `#042f2e` | text on accent fills |
| `--warn` | `#fbbf24` | warnings (amber) |
| `--danger` | `#fb7185` | errors, destructive (rose) |
| `--success` | `#4ade80` | success states (emerald) |

**Status pill colors:**
- `queued` — neutral gray
- `crawling` / `researching` / `planning` / `modifying` / `validating` — teal `--accent`, pulse animation
- `awaiting_dispatch` / `awaiting_preview` — amber `--warn`
- `completed` — emerald `--success`
- `failed` — rose `--danger`
- `cancelled` — neutral, struck-through

**Type system:**
- Sans-serif (`ui-sans-serif, system-ui`), font-features `ss01, cv11` (subtle character variants).
- Page titles: 24px / 600 weight / tight tracking.
- Body: 14px / 400.
- Code/IDs/durations: monospace tabular numbers.

**Density:** comfortable but not airy. ~16px gutters in cards, 8px between
inline elements. Tables: 12px row padding.

**Motion:**
- Status pill transitions: 220ms ease-out color crossfade.
- Pulse on "running" indicators: 1.6s ease-in-out infinite, opacity 1↔0.55
  (this CSS keyframe already exists as `.pulse-soft`).
- New log line: 80ms fade-in. No bounce, no slide-in.

**Iconography:** Lucide icons, 16px in inline contexts, 20px in headers.

**Empty / loading states:** never spinners alone. Always a short sentence
("Waiting for agent to start crawling...") plus the spinner.

---

## 8. Component inventory (already exists — reuse, don't reinvent)

The repo already has these in `dashboard/src/ui/components/`:

- `Badge` — small status/category pill
- `Button` — primary/secondary/ghost variants
- `Card` / `CardHeader` / `CardBody`
- `DevelopDialog` — dispatches a suggestion to Claude Code
- `Field` / `Input`
- `LighthouseDelta` — 4-metric delta strip
- `StatusBadge` / `RunStatusBadge` — status pills
- `SuggestionList`
- `Timeline` — vertical step timeline
- `TraceTree` — recursive span tree
- `useSse` hook — subscribes to SSE event streams

A redesigned dashboard should use these as the visual atoms. If the design
introduces new components (Tabs, Drawer, Tooltip, Gantt strip), they should
match the existing density and palette.

---

## 9. Critical UX behaviors

1. **Live first.** Every visible counter, status, step, suggestion, span,
   and log line must come from the SSE stream. If the stream drops, show a
   small "reconnecting..." chip in the header but keep the last-known state.
2. **No accidental destructive actions.** Cancelling a run requires a
   typed confirmation ("Type CANCEL"). Rejecting a suggestion is one-click
   (it's reversible).
3. **Deep-linkable.** Every tab, every suggestion, every span has a URL
   fragment (`#trace=<spanId>`, `#sug=<id>`). Sharing a link to a failing
   span should jump straight to it.
4. **Optimistic UI.** Clicking "Accept suggestion" should immediately move
   it from "Proposed" to "In flight" with a local pending state; reconcile
   when the server event arrives.
5. **Keyboard shortcuts** on Run detail:
   - `1-5` — switch tabs
   - `j/k` — next/previous suggestion
   - `a` — accept focused suggestion
   - `r` — reject focused suggestion
   - `c` — copy current URL (deep link)
6. **Long output values** (LLM responses, crawl JSON) must collapse with
   "Show 47 more lines" — never blow up the layout.

---

## 10. Out of scope (do NOT design)

- Multi-tenant / org / team views. One operator.
- Auth pages. The app trusts whoever opens it.
- Billing / usage / quota. Not relevant.
- Mobile layouts. Desktop only (the operator is at a laptop watching agents).
- Anything that requires a backend the dashboard doesn't already expose.

---

## 11. How to use this spec with Claude

Paste the whole file into a fresh Claude.ai conversation and say:

> Design the Run detail page (§4.3) as a single React component using
> Tailwind v4 and the existing CSS variables from §7. Use the data shapes
> in §5 and assume the SSE events in §6 are streaming in. Don't invent new
> primitives; use the components listed in §8 where possible.

Then iterate page by page. The spec is the source of truth — push back if
Claude wanders off it.
