import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import type { SpanHandle } from "@/core/ports/tracer.port";
import { AGENTS } from "@growth/shared/constants";
import type {
  BusinessProfile,
  Finding,
  Suggestion,
} from "@growth/shared/types";
import { newId } from "@/lib/id";
import type { CrawlSeoOutput } from "./crawl-seo.agent";
import type { GeoIntelOutput } from "./geo-intel.agent";
import { EnrichmentAgent } from "./enrichment.agent";

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
        const out = await this.rank(ctx, span, input, findings, maxSelected);
        ranked = out.ranked;
        rationale = out.rationale;
      } catch {
        // Non-fatal: the deterministic detector already produced evidence-backed
        // findings, so a bad LLM response degrades to a deterministic plan rather
        // than failing the whole run.
        ranked = null;
      }

      const suggestions = this.materialize(ctx.runId, findings, ranked, maxSelected);

      // Enrich each proven deficit with a business-aware "why it matters" +
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
            suggestions,
          },
        );
        for (const s of suggestions) {
          const e = byId[s.id];
          if (!e) continue;
          s.whyItMatters = e.whyItMatters || undefined;
          s.businessImpact = e.businessImpact || undefined;
        }
      } catch {
        // leave suggestions un-enriched
      }

      const selected = suggestions.filter((s) => s.status === "selected");

      ctx.store.suggestions.insertMany(suggestions);
      for (const s of suggestions) {
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
        proposed: suggestions.length,
        selected: selected.length,
        mode: ranked ? "llm-ranked" : "deterministic-fallback",
      });
      span.end({
        status: "ok",
        attributes: {
          proposed: suggestions.length,
          selected: selected.length,
          fallback: ranked ? false : true,
        },
      });
      return { suggestions, selected, rationale };
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
    maxSelected: number,
  ): Promise<{ ranked: RankedItem[]; rationale: string }> {
    const profile = input.profile;
    const framework = input.crawl.framework ?? "the site's framework";

    const findingsBlock = findings
      .map((f, i) => {
        const evidence = f.evidence.map((e) => `- (${e.source}) ${e.detail}`).join("\n");
        return `#${i} [${f.category}] ${f.issue}
  impact=${f.expectedImpact} risk=${f.risk} baseScore=${f.baseScore}
  evidence:
${evidence}
  default title: ${f.suggestedTitle}
  default fix: ${f.suggestedImplementation}
  targetFiles: ${JSON.stringify(f.targetFiles)}`;
      })
      .join("\n\n");

    const system = `You are the Orchestrator for an autonomous growth-engineering platform working on a ${profile.industry} site built with ${framework}.
You are given DEFICITS that were already detected deterministically from crawl + Lighthouse + geo data. Each deficit carries MEASURED evidence.

Your job is to RANK and PHRASE — NOT to invent. Specifically you must:
- pick the strongest, most implementable deficits and assign each a priorityScore (0..100),
- write a crisp action title and a concrete one-paragraph implementation plan,
- write a 1-sentence rationale tying the fix to the evidence (impact),
- mark exactly up to ${maxSelected} as selected (highest impact, lowest risk, diversified across categories), and
- DROP deficits that are redundant or not worth a PR (omit them from your output).

HARD RULES:
- Refer to each deficit by its #index. Do NOT restate or alter its evidence — it is attached automatically.
- Do NOT introduce deficits that aren't in the list. Every item you output must cite a real #index.
- Each selected item must be implementable in <=6 files.

Output ONLY JSON (no prose), shape:
{
  "items": [
    { "index": 0, "title": "...", "implementation": "...", "rationale": "...", "priorityScore": 0..100, "selected": true }
  ],
  "rationale": "1-2 sentences on what you selected and why"
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
   * Merge LLM phrasing with deterministic findings. Evidence/issue/category/risk
   * always come from the finding; the LLM only contributes title/implementation/
   * rationale/score. When `ranked` is null we fall back to pure findings.
   */
  private materialize(
    runId: string,
    findings: Finding[],
    ranked: RankedItem[] | null,
    maxSelected: number,
  ): Suggestion[] {
    const base = (f: Finding, over?: Partial<RankedItem>): Suggestion => ({
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
      priorityScore:
        typeof over?.priorityScore === "number"
          ? Math.max(0, Math.min(100, over.priorityScore))
          : f.baseScore,
      targetFiles: f.targetFiles,
      geoContext: f.geoContext,
      status: "proposed",
      dispatchJobId: null,
      prNumber: null,
    });

    if (!ranked || ranked.length === 0) {
      // Deterministic fallback: top findings become suggestions, top maxSelected
      // pre-selected by baseScore + lowest risk.
      const sorted = [...findings].sort((a, b) => b.baseScore - a.baseScore);
      const sugs = sorted.map((f) => base(f));
      const riskRank = { low: 0, medium: 1, high: 2 } as const;
      sugs
        .map((s, i) => ({ s, i, risk: riskRank[s.risk] }))
        .sort((a, b) => b.s.priorityScore - a.s.priorityScore || a.risk - b.risk)
        .slice(0, maxSelected)
        .forEach(({ i }) => (sugs[i].status = "selected"));
      return sugs;
    }

    // LLM-ranked path. Keep only items that cite a valid finding index, dedupe by
    // index, and honor the LLM's ordering. Cap selected to maxSelected.
    const seen = new Set<number>();
    const items = ranked.filter((r) => {
      if (r.index < 0 || r.index >= findings.length) return false;
      if (seen.has(r.index)) return false;
      seen.add(r.index);
      return true;
    });
    let selectedCount = 0;
    const sugs = items.map((r) => {
      const s = base(findings[r.index], r);
      if (r.selected && selectedCount < maxSelected) {
        s.status = "selected";
        selectedCount++;
      }
      return s;
    });
    // Guarantee at least one selected if the LLM picked none.
    if (selectedCount === 0 && sugs.length > 0) {
      sugs.sort((a, b) => b.priorityScore - a.priorityScore);
      sugs[0].status = "selected";
    }
    return sugs.sort((a, b) => b.priorityScore - a.priorityScore);
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
