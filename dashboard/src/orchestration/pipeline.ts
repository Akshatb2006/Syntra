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
import { DemandIntelAgent, type DemandIntelOutput } from "@/agents/demand-intel.agent";
import {
  CompetitorIntelAgent,
  type CompetitorIntelOutput,
} from "@/agents/competitor-intel.agent";
import { OrchestratorAgent } from "@/agents/orchestrator.agent";
import { detectDeficits, DETECTOR_VERSION } from "@/orchestration/deficit-detector";
import { applyDemand } from "@/orchestration/demand";
import { applyCompetitorIntel } from "@/orchestration/competitor";
import type { CrawlSeoOutput } from "@/agents/crawl-seo.agent";

/**
 * Version of the audit pipeline (crawl → evidence → findings → ranking) as a
 * whole. Bump on structural changes to what Syntra observes or how it runs the
 * audit (e.g. crawl-depth/hydration/agent-flow changes), distinct from
 * DETECTOR_VERSION which tracks only the deficit ruleset.
 */
export const ENGINE_VERSION = "v0.10";

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

function dedupeStrings(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

/**
 * What the crawl shows the site already covers. `topics` is the human-readable
 * list handed to the competitor agent (so it can judge "net-new"); `tokens` is a
 * lowercased set used deterministically downstream to reject any competitor topic
 * the site has in fact already filled — so a competitor gap is only surfaced when
 * the site genuinely lacks the page.
 */
function buildSiteCoverage(crawl: CrawlSeoOutput): {
  topics: string[];
  tokens: Set<string>;
} {
  const u = crawl.understanding;
  const entityNames = (u?.entities ?? []).map((e) => e.name);
  const gapNames = (u?.contentGaps ?? []).map((g) => g.entity);
  const taxonomy = u?.taxonomy ?? [];
  const pageTypeNames = (crawl.pageTypes ?? []).map((p) => p.type);

  const topics = dedupeStrings([...entityNames, ...gapNames, ...taxonomy]);

  const tokens = new Set<string>();
  for (const t of [...topics, ...pageTypeNames]) {
    const v = t.trim().toLowerCase();
    if (v) tokens.add(v);
  }
  // Crawled path segments — the strongest signal a topic already has a page.
  for (const p of crawl.crawl.pages) {
    try {
      const path = new URL(p.url).pathname.toLowerCase();
      for (const seg of path.split("/")) {
        const s = seg.replace(/[^a-z0-9]+/g, " ").trim();
        if (s.length >= 3) tokens.add(s);
      }
    } catch {
      /* skip unparseable url */
    }
  }
  return { topics, tokens };
}

export async function createRun(
  input: RunInput,
  credentialsRef?: string | null,
  owner?: string | null,
): Promise<Run> {
  const id = newId("run");
  const workspaceId = `ws-${id.slice(-12)}`;
  const now = Date.now();
  const run: Run = {
    id,
    owner: owner ?? null,
    input,
    status: "queued",
    engineVersion: ENGINE_VERSION,
    detectorVersion: DETECTOR_VERSION,
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
      try {
        geo = await new GeoIntelAgent(search).run(rootCtx, {
          city,
          localities: crawl.detectedLocalities,
          siteUrl: run.input.siteUrl,
          industry: profile.industry,
        });
      } catch (err) {
        // Geo is an ENHANCEMENT, not a gate. A flaky geo response (e.g. the LLM
        // returns prose instead of JSON) must not sink an otherwise-good audit —
        // degrade to no geo and let the deterministic deficits stand.
        logger.warn("geo_failed_nonfatal", {
          runId: run.id,
          error: err instanceof Error ? err.message : String(err),
        });
        geo = { byLocality: {}, topOpportunities: [] };
      }
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
    let findings = detectDeficits({ crawl, geo, profile });
    logger.info("deficits_detected", { runId: run.id, count: findings.length });

    // 4b. Demand validation — for the content-gap entities only, observe whether
    //     anyone actually searches for them (SERP presence, competitor ownership,
    //     commercial-vs-regulatory intent) and re-weight the gaps accordingly. Like
    //     geo, this is an ENHANCEMENT: a flaky/empty response degrades to the raw
    //     coverage-based scores rather than sinking the audit.
    const gapByName = new Map(
      (crawl.understanding?.contentGaps ?? []).map((g) => [g.entity, g]),
    );
    const seenEntity = new Set<string>();
    const gapEntities = findings
      .filter((f) => f.category === "content_gap" && f.entityName)
      .filter((f) => {
        const n = f.entityName as string;
        if (seenEntity.has(n)) return false;
        seenEntity.add(n);
        return true;
      })
      .map((f) => {
        const g = gapByName.get(f.entityName as string);
        return {
          name: f.entityName as string,
          kind: f.entityKind ?? "other",
          mentions: g?.mentions ?? 0,
          pageCount: g?.pageCount ?? 0,
        };
      });
    let demand: DemandIntelOutput = { byEntity: {} };
    if (gapEntities.length > 0) {
      try {
        demand = await new DemandIntelAgent(search).run(rootCtx, {
          siteUrl: run.input.siteUrl,
          industry: profile.industry,
          entities: gapEntities,
        });
        findings = applyDemand(findings, demand);
      } catch (err) {
        logger.warn("demand_failed_nonfatal", {
          runId: run.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 4c. Competitor intelligence — observe the competitor set + the topics they
    //     own dedicated pages for, then BOOST gaps competitors share and INJECT
    //     net-new gaps the site doesn't cover at all ("competitors own X, you
    //     don't"). Seeded by the competitor domains demand validation surfaced.
    //     Non-fatal, like demand/geo.
    const seedCompetitors = dedupeStrings(
      Object.values(demand.byEntity ?? {}).flatMap((d) => d.competitorsOwning ?? []),
    );
    const coverage = buildSiteCoverage(crawl);
    try {
      const intel: CompetitorIntelOutput = await new CompetitorIntelAgent(search).run(
        rootCtx,
        {
          siteUrl: run.input.siteUrl,
          industry: profile.industry,
          locationBased: profile.locationBased,
          city,
          seedCompetitors,
          siteTopics: coverage.topics,
        },
      );
      findings = applyCompetitorIntel(findings, intel, { tokens: coverage.tokens });
      logger.info("competitor_intel_done", {
        runId: run.id,
        competitors: intel.competitors.length,
        gaps: intel.gaps.length,
        findings: findings.length,
      });
    } catch (err) {
      logger.warn("competitor_failed_nonfatal", {
        runId: run.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

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
