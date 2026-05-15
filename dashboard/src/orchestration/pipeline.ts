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
import { GeoIntelAgent } from "@/agents/geo-intel.agent";
import { OrchestratorAgent } from "@/agents/orchestrator.agent";

function transition(runId: string, status: RunStatus): void {
  sqliteStore.runs.patchStatus(runId, status);
  eventBus.publish({
    type: "run.status_changed",
    runId,
    status,
    at: Date.now(),
  });
}

function inferCity(input: RunInput): string {
  // Prefer explicit city from the run form. Fall back to a domain heuristic.
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
  return "Bangalore";
}

export function parseRepoFullName(repoUrl: string): string {
  const m = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/.exec(repoUrl);
  if (!m) throw new Error(`Unparseable GitHub repo URL: ${repoUrl}`);
  return `${m[1]}/${m[2]}`;
}

export async function createRun(
  input: RunInput,
  credentialsRef: string,
): Promise<Run> {
  const id = newId("run");
  const workspaceId = `ws-${id.slice(-12)}`;
  const now = Date.now();
  const run: Run = {
    id,
    input,
    status: "queued",
    credentialsRef,
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

  // Verify creds exist BEFORE inserting the run.
  if (!sqliteStore.secrets.get(credentialsRef)) {
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
  const creds = sqliteStore.secrets.get(run.credentialsRef);
  if (!creds) throw new Error("Credentials missing");
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
    attributes: { siteUrl: run.input.siteUrl, repoUrl: run.input.repoUrl },
  });
  const rootCtx = { ...ctx, parentSpan: rootSpan };

  try {
    // 1. Clone repo into MCP workspace.
    transition(run.id, "crawling");
    const trace = { traceId: rootSpan.traceId, parentSpanId: rootSpan.spanId };
    const cloneSpan = tracer.startSpan({
      name: "mcp.repo_clone",
      kind: "mcp_request",
      runId: run.id,
      parentSpanId: rootSpan.spanId,
      attributes: { repoUrl: run.input.repoUrl, traceId: rootSpan.traceId },
    });
    try {
      await mcp.repoClone(
        {
          workspaceId: run.workspaceId,
          repoUrl: run.input.repoUrl,
          githubToken: creds.githubToken,
          branchBase: run.input.branchBase ?? "main",
        },
        trace,
      );
      cloneSpan.end({ status: "ok" });
    } catch (err) {
      cloneSpan.end({
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }

    // 2. Crawl + baseline audit.
    const crawl = await new CrawlSeoAgent(mcp).run(rootCtx, {
      siteUrl: run.input.siteUrl,
    });
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

    // 3. Geo intelligence.
    transition(run.id, "researching");
    const geo = await new GeoIntelAgent(search).run(rootCtx, {
      city: inferCity(run.input),
      localities: crawl.detectedLocalities,
      siteUrl: run.input.siteUrl,
    });

    // 4. Plan & prioritize.
    transition(run.id, "planning");
    const plan = await new OrchestratorAgent().run(rootCtx, {
      siteUrl: run.input.siteUrl,
      crawl,
      geo,
      maxSelected: 3,
    });

    if (plan.suggestions.length === 0) {
      throw new Error("Orchestrator produced zero suggestions");
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
