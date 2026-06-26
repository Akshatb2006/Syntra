import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import type { SpanHandle } from "@/core/ports/tracer.port";
import { AGENTS } from "@growth/shared/constants";
import { modelFor } from "@/lib/models";
import type { BusinessProfile, Suggestion } from "@growth/shared/types";

export interface EnrichmentInput {
  siteUrl: string;
  profile: BusinessProfile;
  pageTypes: Array<{ type: string; count: number }>;
  /** The already-ranked, evidence-backed suggestions to explain. */
  suggestions: Suggestion[];
}

/** Per-suggestion business explanation. Explanation only — never new evidence. */
export interface Enrichment {
  whyItMatters: string;
  businessImpact: string;
}

export interface EnrichmentOutput {
  /** suggestion id -> business explanation. May be partial or empty. */
  byId: Record<string, Enrichment>;
}

/**
 * Recommendation Enrichment agent. Turns a deficit ("WHAT is wrong, with proof")
 * into a consultant-grade note ("WHY it matters to THIS business + WHAT outcome
 * it affects"). This is the layer that makes a finding feel like Syntra
 * understood the business, not just the HTML.
 *
 * Invariant: it can ONLY explain the deficits it is handed. It is structurally
 * incapable of inventing findings — it receives evidence-backed suggestions and
 * returns two text fields per suggestion, keyed by index. It never adds a
 * suggestion, an evidence line, a number, or a page. If the LLM is unavailable
 * or returns junk, the run degrades to un-enriched cards rather than failing.
 */
export class EnrichmentAgent extends BaseAgent<EnrichmentInput, EnrichmentOutput> {
  readonly name = "enrichment" as const;
  readonly title = AGENTS.enrichment.displayName;
  readonly model = modelFor("enrichment");

  async run(ctx: AgentContext, input: EnrichmentInput): Promise<EnrichmentOutput> {
    const span = ctx.tracer.startSpan({
      name: "agent.enrichment",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { siteUrl: input.siteUrl, suggestions: input.suggestions.length },
    });
    const step = this.createStep(ctx, "Explain why each finding matters", input, null);

    try {
      if (input.suggestions.length === 0) {
        this.completeStep(ctx, step, { enriched: 0, mode: "empty" });
        span.end({ status: "ok", attributes: { enriched: 0 } });
        return { byId: {} };
      }

      let byId: Record<string, Enrichment> = {};
      try {
        byId = await this.explain(ctx, span, input);
      } catch {
        // Non-fatal: enrichment is additive. A bad/absent LLM response leaves
        // the cards at Issue -> Evidence -> Implementation rather than failing.
        byId = {};
      }

      this.completeStep(ctx, step, {
        enriched: Object.keys(byId).length,
        of: input.suggestions.length,
      });
      span.end({
        status: "ok",
        attributes: { enriched: Object.keys(byId).length },
      });
      return { byId };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      // Still non-fatal to the pipeline — caller treats a throw as "no enrichment".
      return { byId: {} };
    }
  }

  private async explain(
    ctx: AgentContext,
    span: SpanHandle,
    input: EnrichmentInput,
  ): Promise<Record<string, Enrichment>> {
    const { profile, suggestions } = input;

    const pageTypeLine = input.pageTypes.length
      ? input.pageTypes.map((p) => `${p.type}(${p.count})`).join(", ")
      : "unknown";
    const sells = profile.summary ? `\nWhat they sell: ${profile.summary}` : "";
    const audience = profile.audience ? `\nAudience: ${profile.audience}` : "";
    const market = profile.locationBased
      ? "\nMarket: location-based (serves specific places)"
      : "\nMarket: not location-specific";

    const deficitsBlock = suggestions
      .map((s, i) => {
        const evidence = s.evidence
          .map((e) => `    - (${e.source}) ${e.detail}${e.url ? ` [${pathOf(e.url)}]` : ""}`)
          .join("\n");
        const geo = s.geoContext ? ` geo=${s.geoContext.locality}` : "";
        return `#${i} [${s.category}]${geo} ${s.issue || s.title}
  proof:
${evidence || "    - (no measured evidence)"}
  planned fix: ${s.implementation || "(none)"}`;
      })
      .join("\n\n");

    const system = `You are a senior SEO & growth consultant writing the short "why this matters" note a paying client reads beside each finding.

You are handed (a) a profile of the client's business and (b) a list of DEFICITS that were already detected and PROVEN on their site — each with measured evidence. For EACH deficit, write two things, specific to THIS business:

1. why_it_matters — 1-2 sentences. Tie the gap to the client's actual buyers and the page's purpose. Name the real search/AI-answer behavior or buyer question at stake (e.g. for an AI-automation agency: "how much does it cost", "how long to implement", "which CRMs integrate", "ROI"). Never the generic "improves SEO".
2. business_impact — 1 sentence naming the concrete commercial outcome affected: buyer-intent organic traffic, qualified leads, AI-assistant (ChatGPT/Perplexity) answer citations, social-share click-through, or topical authority — only the ones that genuinely apply.

HARD RULES:
- You may ONLY explain the deficits in the list. Never introduce a new issue, page, number, recommendation, or fact not present above. You are explaining findings, not finding them.
- Be concrete to THIS business — use its industry, what it sells, its audience and market. Generic notes that would fit any website are failures.
- Do not restate the fix or the evidence. Explanation only. Plain text, no markdown.
- Refer to each deficit by its #index.

Output ONLY JSON (no prose):
{ "items": [ { "index": 0, "why_it_matters": "...", "business_impact": "..." } ] }`;

    const userPrompt = `CLIENT BUSINESS
Industry: ${profile.industry}${sells}${audience}${market}
Site: ${input.siteUrl}
Page types crawled: ${pageTypeLine}

DEFICITS TO EXPLAIN (reference by #index; explain every one):

${deficitsBlock}

Produce the JSON now.`;

    const { text } = await this.toolLoop(ctx, span, {
      system,
      userPrompt,
      tools: [] as Array<ToolDef<unknown, unknown>>,
      maxRounds: 1,
      maxTokens: 8192,
    });

    return this.parse(text, suggestions);
  }

  private parse(text: string, suggestions: Suggestion[]): Record<string, Enrichment> {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return {};
    let obj: { items?: Array<{ index?: number; why_it_matters?: string; business_impact?: string }> };
    try {
      obj = JSON.parse(text.slice(start, end + 1));
    } catch {
      return {};
    }
    const out: Record<string, Enrichment> = {};
    for (const it of obj.items ?? []) {
      if (typeof it.index !== "number") continue;
      const s = suggestions[it.index];
      if (!s) continue;
      const why = clamp(it.why_it_matters);
      const impact = clamp(it.business_impact);
      if (!why && !impact) continue;
      out[s.id] = { whyItMatters: why, businessImpact: impact };
    }
    return out;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

function clamp(v: unknown, max = 600): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
