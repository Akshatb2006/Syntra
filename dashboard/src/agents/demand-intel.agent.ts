import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import { AGENTS } from "@growth/shared/constants";
import type { SearchPort } from "@/core/ports/search.port";
import type { DemandSignal, DemandBand, DemandIntent } from "@growth/shared/types";

/** One content-gap entity to validate demand for. */
export interface DemandEntity {
  name: string;
  kind: string;
  mentions: number;
  pageCount: number;
}

export interface DemandIntelInput {
  siteUrl: string;
  /** Industry label so SERP queries and intent judgement fit the business. */
  industry: string;
  entities: DemandEntity[];
}

export interface DemandIntelOutput {
  /** Keyed by entity name (exact, as supplied) → its demand verdict. */
  byEntity: Record<string, DemandSignal>;
}

const VALID_BANDS = new Set<DemandBand>(["high", "medium", "low", "unknown"]);
const VALID_INTENTS = new Set<DemandIntent>([
  "commercial",
  "navigational",
  "informational",
  "regulatory",
  "unknown",
]);

/** Cap the entities we research per run so cost/latency stay bounded. */
const MAX_ENTITIES = 6;

/**
 * Demand Validation agent. For each entity the site mentions heavily but doesn't
 * own a page for, it answers the question the content-gap detector can't:
 * "does anyone actually search for this?" — so a commercial platform a brokerage
 * should obviously own ("Bayut") ranks far above a compliance body mentioned for
 * completeness ("Texas Real Estate Commission").
 *
 * Mirrors the Geo agent's discipline: it OBSERVES demand via web_search
 * (competitor pages that rank, SERP presence) and judges commercial-vs-regulatory
 * intent — it NEVER fabricates a search-volume number (we have no volume feed).
 * `score` is a derived "worth building" strength, not a monthly-volume claim.
 */
export class DemandIntelAgent extends BaseAgent<DemandIntelInput, DemandIntelOutput> {
  readonly name = "demand_intel" as const;
  readonly title = AGENTS.demand_intel.displayName;
  readonly model = AGENTS.demand_intel.model;

  constructor(private search: SearchPort) {
    super();
  }

  async run(ctx: AgentContext, input: DemandIntelInput): Promise<DemandIntelOutput> {
    const entities = input.entities.slice(0, MAX_ENTITIES);
    const span = ctx.tracer.startSpan({
      name: "agent.demand_intel",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { siteUrl: input.siteUrl, entities: entities.map((e) => e.name) },
    });
    const step = this.createStep(
      ctx,
      `Validate demand for ${entities.length} entit${entities.length === 1 ? "y" : "ies"}`,
      input,
      null,
    );

    if (entities.length === 0) {
      this.completeStep(ctx, step, { entities: 0, mode: "empty" });
      span.end({ status: "ok", attributes: { entities: 0 } });
      return { byEntity: {} };
    }

    try {
      const siteHost = hostOf(input.siteUrl);
      const tools: Array<ToolDef<unknown, unknown>> = [
        {
          name: "web_search",
          description:
            "Search the web to observe real demand for an entity: who ranks for it, whether competitor sites have dedicated pages, and whether there is commercial search activity. Use queries like '<entity>', '<entity> <industry>', or '<entity> integration'.",
          input_schema: {
            type: "object",
            properties: {
              query: { type: "string" },
              maxResults: { type: "number" },
            },
            required: ["query"],
          },
          execute: async (raw) => {
            const i = raw as { query: string; maxResults?: number };
            const results = await this.search.search(i.query, {
              maxResults: i.maxResults ?? 6,
            });
            // Hand the model just what it needs to judge demand + ownership:
            // ranking domains and titles. Drop our own site so "competitorsOwning"
            // never includes the customer.
            return results
              .filter((r) => hostOf(r.url) !== siteHost)
              .map((r) => ({ domain: hostOf(r.url), title: r.title, url: r.url }));
          },
        },
      ];

      const system = `You are the Demand Validation Agent for an autonomous growth-engineering platform. The target is a ${input.industry} business. You are given ENTITIES that the site mentions repeatedly but has no dedicated page for. Your job is to judge, for each, whether building a page is worth it — i.e. does the entity attract real, commercial search demand, or is it just mentioned for completeness (a law, a regulator, a generic term)?

For EACH entity:
1. Call web_search ONCE for the entity (e.g. "<entity>" or "<entity> ${input.industry}") to observe real demand. Note which competitor domains rank and whether any have a dedicated page/section for it.
2. Judge its intent:
   - "commercial"   → a brand/platform/integration people adopt or compare (high value to own).
   - "navigational" → searched to reach a specific known destination.
   - "informational"→ researched but not transacted.
   - "regulatory"   → a law, government body, or compliance term mentioned for completeness, with no acquisition demand (e.g. a real-estate commission, E-Verify). LOW value.
3. Assign a demand score 0..100 reflecting how worth-building a dedicated page is: commercial entities with visible competitor pages score high (80-95); regulatory/compliance terms score low (10-30); unclear cases sit in the middle.

CRITICAL HONESTY RULES:
- The "evidence" array must reflect ONLY what web_search actually returned (competitor domains seen, dedicated pages observed). Do NOT invent search volumes — we have no volume data. If a search returned nothing useful, leave evidence empty and set observed=false.
- "competitorsOwning" lists ONLY domains you actually saw ranking with a page about this entity. Never include the target site. Empty is fine.

Output ONLY a single JSON object, no prose:
{
  "entities": [
    {
      "entity": "<exact entity name as given>",
      "score": 0..100,
      "band": "high" | "medium" | "low" | "unknown",
      "intent": "commercial" | "navigational" | "informational" | "regulatory" | "unknown",
      "competitorsOwning": ["domain.com"],
      "evidence": ["competitor X ranks with a dedicated <entity> page", "N results reference <entity>"],
      "observed": true | false
    }
  ]
}`;

      const entityBlock = entities
        .map(
          (e) =>
            `- "${e.name}" (${e.kind}) — mentioned ${e.mentions}× across ${e.pageCount} page${e.pageCount === 1 ? "" : "s"}`,
        )
        .join("\n");

      const userPrompt = `Target site: ${input.siteUrl}
Business: ${input.industry}

ENTITIES the site mentions but has no dedicated page for:
${entityBlock}

Research each (one web_search each) and produce the JSON. Be ruthless: regulatory/compliance mentions and generic terms get LOW scores even if mentioned often; commercial platforms/brands/integrations competitors already build pages for get HIGH scores.`;

      const { text } = await this.toolLoop(ctx, span, {
        system,
        userPrompt,
        tools,
        maxRounds: Math.min(8, entities.length + 2),
        maxTokens: 4096,
      });

      const byEntity = this.parse(text, entities);

      this.completeStep(ctx, step, {
        entities: entities.length,
        validated: Object.keys(byEntity).length,
        scores: Object.fromEntries(
          Object.values(byEntity).map((d) => [d.entity, d.score]),
        ),
      });
      span.end({
        status: "ok",
        attributes: { entities: entities.length, validated: Object.keys(byEntity).length },
      });
      return { byEntity };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      throw e;
    }
  }

  /**
   * Parse the model's JSON into a name→DemandSignal map, clamping/normalizing
   * every field. Only entities we actually asked about are kept (the model can't
   * smuggle in extras), and the score/band are reconciled so display stays honest.
   */
  private parse(text: string, asked: DemandEntity[]): Record<string, DemandSignal> {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return {};
    let obj: { entities?: Array<Record<string, unknown>> };
    try {
      obj = JSON.parse(text.slice(start, end + 1));
    } catch {
      return {};
    }
    const askedByLower = new Map(asked.map((e) => [e.name.toLowerCase(), e.name]));
    const out: Record<string, DemandSignal> = {};
    for (const raw of obj.entities ?? []) {
      const rawName = String(raw.entity ?? "").trim();
      const canonical = askedByLower.get(rawName.toLowerCase());
      if (!canonical) continue; // only keep entities we asked about

      const score = clampScore(raw.score);
      const intent = VALID_INTENTS.has(raw.intent as DemandIntent)
        ? (raw.intent as DemandIntent)
        : "unknown";
      const competitorsOwning = Array.isArray(raw.competitorsOwning)
        ? raw.competitorsOwning
            .map((d) => String(d).trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 5)
        : [];
      const evidence = Array.isArray(raw.evidence)
        ? raw.evidence.map((d) => String(d).trim()).filter(Boolean).slice(0, 4)
        : [];
      const observed = Boolean(raw.observed) && evidence.length > 0;
      // Derive the band from the score so the label and the number never disagree,
      // unless the model explicitly said "unknown" with no signal at all.
      const band: DemandBand =
        !observed && evidence.length === 0 && raw.band === "unknown"
          ? "unknown"
          : bandForScore(score);

      out[canonical] = {
        entity: canonical,
        score,
        band,
        intent,
        competitorsOwning,
        evidence,
        observed,
      };
    }
    return out;
  }
}

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function bandForScore(score: number): DemandBand {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
