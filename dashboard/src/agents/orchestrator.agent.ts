import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import type { SpanHandle } from "@/core/ports/tracer.port";
import { AGENTS } from "@growth/shared/constants";
import type { BusinessProfile, Finding, Suggestion } from "@growth/shared/types";
import { newId } from "@/lib/id";
import type { CrawlSeoOutput } from "./crawl-seo.agent";
import type { GeoIntelOutput } from "./geo-intel.agent";
import { EnrichmentAgent } from "./enrichment.agent";
import {
  CATEGORY_FAMILY,
  FAMILIES,
  scoreOpportunity,
  type Family,
} from "@/orchestration/scoring";

export interface OrchestratorInput {
  siteUrl: string;
  crawl: CrawlSeoOutput;
  geo: GeoIntelOutput;
  profile: BusinessProfile;
  /** Evidence-backed deficits detected deterministically before any LLM call. */
  findings: Finding[];
  maxSelected?: number;
}

export interface OrchestratorOutput {
  suggestions: Suggestion[];
  selected: Suggestion[];
  rationale: string;
}

/** What the LLM is allowed to decide — phrasing and ranking only, never evidence. */
interface RankedItem {
  index: number;
  title: string;
  implementation: string;
  rationale: string;
  priorityScore: number;
  selected: boolean;
}

/**
 * Per-family slot budget for the final report. `min` guarantees representation
 * (business/content gaps can't be crowded out by hygiene; basics can't be
 * skipped); `max` stops any one family from taking over. Mins are best-effort —
 * a family with fewer real findings simply contributes what it has. The family
 * map itself lives in scoring.ts so ranking and selection share one definition.
 */
const FAMILY_QUOTA: Record<Family, { min: number; max: number }> = {
  business: { min: 3, max: 5 },
  technical: { min: 2, max: 4 },
  performance: { min: 0, max: 3 },
  accessibility: { min: 0, max: 2 },
};

/** Total cards in a balanced report. */
const REPORT_BUDGET = 12;

const RISK_RANK = { low: 0, medium: 1, high: 2 } as const;

/** Strongest-first: higher priority, then lower risk. */
function byPriority(a: Suggestion, b: Suggestion): number {
  return b.priorityScore - a.priorityScore || RISK_RANK[a.risk] - RISK_RANK[b.risk];
}

/**
 * Collapse duplicate candidates (same category + same deficit statement) down to
 * the strongest one. Near-duplicate crawled URLs (e.g. /blog and /blog/) produce
 * identical findings; without this they'd each take a report slot. Keyed on the
 * deficit-centric `issue` (which includes the normalized path), so genuinely
 * distinct pages stay separate.
 */
function dedupe(candidates: Suggestion[]): Suggestion[] {
  const best = new Map<string, Suggestion>();
  for (const s of candidates) {
    const key = `${s.category}::${s.issue}`;
    const prev = best.get(key);
    if (!prev || byPriority(s, prev) < 0) best.set(key, s);
  }
  return [...best.values()];
}

/**
 * Pick the final report from ALL materialized candidates using deterministic
 * family quotas. Phase 1 fills each family up to its `min` (best-first within
 * the family) so business/content and structural-SEO are always represented;
 * Phase 2 fills the remaining slots by global priority, respecting each family's
 * `max`. This is what guarantees a brand gap like HubSpot a seat instead of
 * losing it to a stack of Lighthouse hygiene cards.
 */
function selectBalanced(candidates: Suggestion[], budget = REPORT_BUDGET): Suggestion[] {
  const byScore = [...dedupe(candidates)].sort(byPriority);
  const perFamily = new Map<Family, Suggestion[]>(FAMILIES.map((f) => [f, []]));
  for (const s of byScore) perFamily.get(CATEGORY_FAMILY[s.category])?.push(s);

  const chosen = new Set<Suggestion>();
  const count: Record<Family, number> = {
    business: 0,
    technical: 0,
    performance: 0,
    accessibility: 0,
  };

  // Phase 1 — guarantee minimums (capped by what's actually available).
  for (const fam of FAMILIES) {
    for (const s of perFamily.get(fam) ?? []) {
      if (count[fam] >= FAMILY_QUOTA[fam].min || chosen.size >= budget) break;
      chosen.add(s);
      count[fam]++;
    }
  }

  // Phase 2 — fill remaining slots by score, never exceeding a family's max.
  for (const s of byScore) {
    if (chosen.size >= budget) break;
    if (chosen.has(s)) continue;
    const fam = CATEGORY_FAMILY[s.category];
    if (count[fam] >= FAMILY_QUOTA[fam].max) continue;
    chosen.add(s);
    count[fam]++;
  }

  return [...chosen].sort(byPriority);
}

/** Count the report's cards per family — surfaced in the step log for trust. */
function familyBreakdown(report: Suggestion[]): Record<Family, number> {
  const c: Record<Family, number> = {
    business: 0,
    technical: 0,
    performance: 0,
    accessibility: 0,
  };
  for (const s of report) c[CATEGORY_FAMILY[s.category]]++;
  return c;
}

export class OrchestratorAgent extends BaseAgent<OrchestratorInput, OrchestratorOutput> {
  readonly name = "orchestrator" as const;
  readonly title = AGENTS.orchestrator.displayName;
  readonly model = AGENTS.orchestrator.model;

  async run(ctx: AgentContext, input: OrchestratorInput): Promise<OrchestratorOutput> {
    const span = ctx.tracer.startSpan({
      name: "agent.orchestrator",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { siteUrl: input.siteUrl, findings: input.findings.length },
    });
    const step = this.createStep(ctx, "Rank & prioritize deficits", input, null);

    try {
      const maxSelected = input.maxSelected ?? 3;
      // Cap the findings sent to the LLM; they're already sorted strongest-first.
      const findings = input.findings.slice(0, 25);

      if (findings.length === 0) {
        // Nothing measurable was found — surface an honest empty plan rather
        // than inventing recommendations.
        this.completeStep(ctx, step, { proposed: 0, selected: 0, mode: "empty" });
        span.end({ status: "ok", attributes: { proposed: 0, selected: 0 } });
        return { suggestions: [], selected: [], rationale: "No deficits detected." };
      }

      // Ask the LLM to RANK and PHRASE only. It references findings by index and
      // may not alter their evidence/issue/category — those are merged back in
      // from the deterministic finding, so every shipped suggestion stays backed
      // by measured proof.
      let ranked: RankedItem[] | null = null;
      let rationale = "";
      try {
        const out = await this.rank(ctx, span, input, findings);
        ranked = out.ranked;
        rationale = out.rationale;
      } catch {
        // Non-fatal: the deterministic detector already produced evidence-backed
        // findings, so a bad LLM response degrades to a deterministic plan rather
        // than failing the whole run.
        ranked = null;
      }

      // Materialize EVERY finding into a candidate (LLM phrasing where it ranked
      // one, deterministic otherwise), then pick a balanced report via family
      // quotas. Coverage is decided HERE, deterministically — not by which
      // findings the LLM happened to keep — so business gaps can't be crowded out.
      const candidates = this.materialize(ctx.runId, findings, ranked);
      const report = selectBalanced(candidates);

      // Pre-select the top few (highest priority, lowest risk) for one-click
      // dispatch; the rest stay "proposed".
      [...report]
        .sort(byPriority)
        .slice(0, maxSelected)
        .forEach((s) => {
          s.status = "selected";
        });

      // Enrich ONLY the report set with a business-aware "why it matters" +
      // "business impact" BEFORE persisting. Additive and best-effort: the
      // Enrichment agent can only explain these findings, never add to them, and
      // a failure leaves the cards un-enriched rather than failing the run.
      try {
        const { byId } = await new EnrichmentAgent().run(
          { ...ctx, parentSpan: span },
          {
            siteUrl: input.siteUrl,
            profile: input.profile,
            pageTypes: input.crawl.pageTypes,
            suggestions: report,
          },
        );
        for (const s of report) {
          const e = byId[s.id];
          if (!e) continue;
          s.whyItMatters = e.whyItMatters || undefined;
          s.businessImpact = e.businessImpact || undefined;
        }
      } catch {
        // leave suggestions un-enriched
      }

      const selected = report.filter((s) => s.status === "selected");

      ctx.store.suggestions.insertMany(report);
      for (const s of report) {
        ctx.events.publish({
          type: "suggestion.proposed",
          runId: ctx.runId,
          suggestion: s,
        });
      }
      for (const s of selected) {
        ctx.events.publish({
          type: "suggestion.selected",
          runId: ctx.runId,
          suggestionId: s.id,
        });
      }

      this.completeStep(ctx, step, {
        proposed: report.length,
        selected: selected.length,
        families: familyBreakdown(report),
        mode: ranked ? "llm-ranked" : "deterministic-fallback",
      });
      span.end({
        status: "ok",
        attributes: {
          proposed: report.length,
          selected: selected.length,
          fallback: ranked ? false : true,
        },
      });
      return { suggestions: report, selected, rationale };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      throw e;
    }
  }

  /** LLM ranking pass. Returns ranked items or throws (caller falls back). */
  private async rank(
    ctx: AgentContext,
    span: SpanHandle,
    input: OrchestratorInput,
    findings: Finding[],
  ): Promise<{ ranked: RankedItem[]; rationale: string }> {
    const profile = input.profile;
    const framework = input.crawl.framework ?? "the site's framework";

    const findingsBlock = findings
      .map((f, i) => {
        const evidence = f.evidence.map((e) => `- (${e.source}) ${e.detail}`).join("\n");
        const demand = f.demand
          ? `\n  demand: ${f.demand.band} (${f.demand.intent} intent, score ${f.demand.score}/100${f.demand.competitorsOwning.length > 0 ? `, ${f.demand.competitorsOwning.length} competitor page(s)` : ""})`
          : "";
        return `#${i} [${f.category}] ${f.issue}
  impact=${f.expectedImpact} risk=${f.risk} baseScore=${f.baseScore}${demand}
  evidence:
${evidence}
  default title: ${f.suggestedTitle}
  default fix: ${f.suggestedImplementation}
  targetFiles: ${JSON.stringify(f.targetFiles)}`;
      })
      .join("\n\n");

    const system = `You are the Orchestrator for an autonomous growth-engineering platform working on a ${profile.industry} site built with ${framework}.
You are given DEFICITS that were already detected deterministically from crawl + Lighthouse + geo data. Each deficit carries MEASURED evidence.

Your job is to PHRASE — NOT to invent and NOT to score. Priority is computed by
the platform deterministically (impact / demand / competitive gap / effort /
confidence), so you do not assign numbers. For each deficit you must:
- write a crisp action title,
- write a concrete one-paragraph implementation plan,
- write a 1-sentence rationale tying the fix to its evidence (and to its demand /
  competitor signal when present).

Phrase EVERY deficit you are given; any deficit you omit simply keeps its default
phrasing. The "demand:" line on some deficits (validated search demand + competitor
ownership) is useful context for your rationale — lean on it when it's there.

HARD RULES:
- Refer to each deficit by its #index. Do NOT restate or alter its evidence — it is attached automatically.
- Do NOT introduce deficits that aren't in the list. Every item you output must cite a real #index.
- Each item must be implementable in <=6 files.

Output ONLY JSON (no prose), shape:
{
  "items": [
    { "index": 0, "title": "...", "implementation": "...", "rationale": "..." }
  ],
  "rationale": "1-2 sentences on the overall priorities"
}`;

    const userPrompt = `SITE: ${input.siteUrl}
Business: ${profile.industry}${profile.locationBased ? " (location-based)" : ""}
Lighthouse: ${JSON.stringify(input.crawl.baseline.scores)}

DEFICITS (ranked strongest-first; cite by #index):

${findingsBlock}

Produce the JSON now.`;

    const { text } = await this.toolLoop(ctx, span, {
      system,
      userPrompt,
      tools: [] as Array<ToolDef<unknown, unknown>>,
      maxRounds: 1,
      maxTokens: 8192,
    });

    const parsed = this.parseRanked(text, findings.length);
    if (!parsed) throw new Error("Orchestrator returned invalid JSON");
    return parsed;
  }

  /**
   * Materialize EVERY finding into a candidate suggestion. Evidence/issue/
   * category/risk always come from the deterministic finding; the LLM only
   * contributes title/implementation/rationale/score for the findings it ranked
   * (matched by #index). Findings the LLM didn't rank get deterministic phrasing
   * and their baseScore — so coverage never depends on the LLM, only phrasing
   * does. Family-quota selection downstream decides which candidates ship.
   */
  private materialize(
    runId: string,
    findings: Finding[],
    ranked: RankedItem[] | null,
  ): Suggestion[] {
    const base = (f: Finding, over?: Partial<RankedItem>): Suggestion => {
      // Priority is now DETERMINISTIC: the decomposed opportunity score, derived
      // from measured signals (impact / demand / competitive gap / effort /
      // confidence). The LLM contributes phrasing only — it no longer owns the
      // number, so the ranking is transparent and reproducible.
      const opportunity = scoreOpportunity(f);
      return {
        id: newId("sug"),
        runId,
        category: f.category,
        title: over?.title?.trim() || f.suggestedTitle,
        issue: f.issue,
        evidence: f.evidence,
        confidence: f.confidence,
        description: over?.title?.trim() || f.suggestedTitle,
        rationale: over?.rationale?.trim() || `${f.expectedImpact} impact (${f.category}).`,
        implementation: over?.implementation?.trim() || f.suggestedImplementation,
        expectedImpact: f.expectedImpact,
        risk: f.risk,
        priorityScore: opportunity.priority,
        opportunity,
        targetFiles: f.targetFiles,
        demand: f.demand,
        geoContext: f.geoContext,
        status: "proposed",
        dispatchJobId: null,
        prNumber: null,
      };
    };

    // Index the LLM's phrasing/scores by the finding they cite (first wins).
    const overById = new Map<number, RankedItem>();
    if (ranked) {
      for (const r of ranked) {
        if (r.index < 0 || r.index >= findings.length) continue;
        if (!overById.has(r.index)) overById.set(r.index, r);
      }
    }
    // One candidate per finding — all start "proposed"; selection happens later.
    return findings.map((f, i) => base(f, overById.get(i)));
  }

  private parseRanked(
    text: string,
    findingCount: number,
  ): { ranked: RankedItem[]; rationale: string } | null {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      const obj = JSON.parse(text.slice(start, end + 1)) as {
        items?: Array<Partial<RankedItem>>;
        rationale?: string;
      };
      const items = (obj.items ?? [])
        .filter((it) => typeof it.index === "number")
        .map((it) => ({
          index: it.index as number,
          title: String(it.title ?? ""),
          implementation: String(it.implementation ?? ""),
          rationale: String(it.rationale ?? ""),
          priorityScore:
            typeof it.priorityScore === "number" ? it.priorityScore : 50,
          selected: Boolean(it.selected),
        }))
        .filter((it) => it.index >= 0 && it.index < findingCount);
      if (items.length === 0) return null;
      return { ranked: items, rationale: obj.rationale ?? "" };
    } catch {
      return null;
    }
  }
}
