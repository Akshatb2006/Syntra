import type { Run, RunStatus, RunInput } from "@growth/shared/types";
import { newId } from "@/lib/id";
import { logger } from "@/lib/logger";
import { sqliteStore } from "@/infra/store/sqlite";
import { eventBus } from "@/infra/eventbus/local.bus";
import { getTracer } from "@/infra/tracer";
import { getMcp } from "@/infra/mcp/http.client";
import { AnthropicClient } from "@/infra/llm/anthropic.client";
import { getSearch } from "@/infra/search/tavily.client";
import { CrawlSeoAgent } from "@/agents/crawl-seo.agent";
import { GeoIntelAgent, type GeoIntelOutput } from "@/agents/geo-intel.agent";
import { OrchestratorAgent } from "@/agents/orchestrator.agent";
import { detectDeficits } from "@/orchestration/deficit-detector";

function transition(runId: string, status: RunStatus): void {
  sqliteStore.runs.patchStatus(runId, status);
  eventBus.publish({
    type: "run.status_changed",
    runId,
    status,
    at: Date.now(),
  });
}

function inferCity(input: RunInput): string | null {
  // Prefer the explicit city from the run form. Fall back to a light hostname
  // heuristic. Returns null when nothing is known — the local-intel step is
  // skipped rather than defaulting to any specific city.
  if (input.city && input.city.trim()) return input.city.trim();
  try {
    const host = new URL(input.siteUrl).hostname.toLowerCase();
    const tokens = [
      "bangalore",
      "bengaluru",
      "mumbai",
      "pune",
      "hyderabad",
      "delhi",
      "gurgaon",
      "noida",
      "chennai",
      "kolkata",
      "ahmedabad",
      "jaipur",
      "amsterdam",
      "rotterdam",
      "utrecht",
    ];
    for (const t of tokens) {
      if (host.includes(t)) return t.charAt(0).toUpperCase() + t.slice(1);
    }
  } catch {
    // ignore
  }
  return null;
}

export function parseRepoFullName(repoUrl: string): string {
  const m = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/.exec(repoUrl);
  if (!m) throw new Error(`Unparseable GitHub repo URL: ${repoUrl}`);
  return `${m[1]}/${m[2]}`;
}

export async function createRun(
  input: RunInput,
  credentialsRef?: string | null,
): Promise<Run> {
  const id = newId("run");
  const workspaceId = `ws-${id.slice(-12)}`;
  const now = Date.now();
  const run: Run = {
    id,
    input,
    status: "queued",
    // "" means "not connected yet" — an audit-only run. Credentials are
    // attached later, at implement time.
    credentialsRef: credentialsRef ?? "",
    workspaceId,
    prUrl: null,
    previewUrl: null,
    baselineLighthouse: null,
    afterLighthouse: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  // Only verify creds when this run was started WITH them. Audit-only runs
  // carry none and that's valid.
  if (credentialsRef && !sqliteStore.secrets.get(credentialsRef)) {
    throw new Error(`Credentials reference not found: ${credentialsRef}`);
  }

  sqliteStore.runs.insert(run);
  eventBus.publish({ type: "run.created", runId: id, at: now });

  // Fire-and-forget. Caller returns immediately with the runId.
  void runPipeline(run).catch((err) => {
    logger.error("pipeline_unhandled", {
      runId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    sqliteStore.runs.patch(id, {
      status: "failed",
      error: { message: err instanceof Error ? err.message : String(err) },
      completedAt: Date.now(),
    });
    eventBus.publish({
      type: "run.failed",
      runId: id,
      error: err instanceof Error ? err.message : String(err),
      at: Date.now(),
    });
  });

  return run;
}

/**
 * Audit pipeline. Runs crawl → research → plan, then stops and waits for the
 * user to trigger per-suggestion dispatches via the `/runs/[id]/suggestions/...`
 * API route. The Code Modification agent is NOT auto-invoked.
 */
async function runPipeline(run: Run): Promise<void> {
  // No credentials needed: the audit (crawl → detect → plan) runs entirely off
  // the public site URL. The repo + token are only required later, to implement
  // a fix.
  const tracer = getTracer();
  const mcp = getMcp();
  const search = getSearch();
  const llm = new AnthropicClient();
  const ctx = {
    runId: run.id,
    parentSpan: null,
    tracer,
    store: sqliteStore,
    events: eventBus,
    llm,
  };

  const rootSpan = tracer.startSpan({
    name: "pipeline.run",
    kind: "internal",
    runId: run.id,
    attributes: { siteUrl: run.input.siteUrl, repoUrl: run.input.repoUrl ?? null },
  });
  const rootCtx = { ...ctx, parentSpan: rootSpan };

  try {
    // 1. Crawl + baseline audit — straight off the public URL (also classifies
    //    the business profile). No repo, no credentials.
    transition(run.id, "crawling");
    const crawl = await new CrawlSeoAgent(mcp).run(rootCtx, {
      siteUrl: run.input.siteUrl,
      profileHint: run.input.businessProfileHint,
    });
    const profile = crawl.businessProfile;
    sqliteStore.runs.patch(run.id, {
      baselineLighthouse: {
        url: crawl.baseline.url,
        performance: crawl.baseline.scores.performance,
        accessibility: crawl.baseline.scores.accessibility,
        bestPractices: crawl.baseline.scores.bestPractices,
        seo: crawl.baseline.scores.seo,
        fetchedAt: crawl.baseline.fetchedAt,
      },
    });

    // 3. Local intelligence — only for businesses that actually serve specific
    //    places, and only when we know which city. Otherwise it's skipped (no
    //    fabricated geography for SaaS/blogs/global e-commerce).
    let geo: GeoIntelOutput = { byLocality: {}, topOpportunities: [] };
    const city = inferCity(run.input);
    if (profile.locationBased && city) {
      transition(run.id, "researching");
      geo = await new GeoIntelAgent(search).run(rootCtx, {
        city,
        localities: crawl.detectedLocalities,
        siteUrl: run.input.siteUrl,
        industry: profile.industry,
      });
    } else {
      logger.info("geo_skipped", {
        runId: run.id,
        locationBased: profile.locationBased,
        city,
      });
    }

    // 4. Detect deficits deterministically (measured evidence), then let the
    //    orchestrator rank/phrase them. Evidence is computed here, in code —
    //    the LLM cannot invent it.
    transition(run.id, "planning");
    const findings = detectDeficits({ crawl, geo, profile });
    logger.info("deficits_detected", { runId: run.id, count: findings.length });

    const plan = await new OrchestratorAgent().run(rootCtx, {
      siteUrl: run.input.siteUrl,
      crawl,
      geo,
      profile,
      findings,
      maxSelected: 3,
    });

    if (plan.suggestions.length === 0) {
      // No measurable deficits is a valid (clean-site) outcome, not a failure.
      logger.info("no_deficits", { runId: run.id });
    }

    // 5. Hand off to the user. They trigger dispatches per suggestion via the UI.
    transition(run.id, "awaiting_dispatch");
    rootSpan.end({ status: "ok" });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.error("pipeline_failed", { runId: run.id, error: e.message });
    sqliteStore.runs.patch(run.id, {
      status: "failed",
      error: { message: e.message, stack: e.stack },
      completedAt: Date.now(),
    });
    eventBus.publish({
      type: "run.failed",
      runId: run.id,
      error: e.message,
      at: Date.now(),
    });
    rootSpan.end({ status: "error", error: e });
    await tracer.flush?.();
  }
}
