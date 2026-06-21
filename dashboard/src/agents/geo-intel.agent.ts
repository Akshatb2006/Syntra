import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import { AGENTS } from "@growth/shared/constants";
import type { SearchPort } from "@/core/ports/search.port";
import type { GeoSuggestionContext } from "@growth/shared/types";

export interface GeoIntelInput {
  city: string;
  localities: string[];
  siteUrl: string;
  /** Industry label so keyword/intent generation fits the business. */
  industry: string;
}

export interface GeoIntelOutput {
  byLocality: Record<string, GeoSuggestionContext>;
  topOpportunities: Array<{
    locality: string;
    score: number;
    rationale: string;
    /**
     * Demand signals found via web search (competitor pages that rank, SERP
     * presence for "<service> <locality>"). Used to gate locality_page findings
     * so they're backed by observed demand, not just "it's location-based".
     */
    evidence?: string[];
  }>;
}

export class GeoIntelAgent extends BaseAgent<GeoIntelInput, GeoIntelOutput> {
  readonly name = "geo_intel" as const;
  readonly title = AGENTS.geo_intel.displayName;
  readonly model = AGENTS.geo_intel.model;

  constructor(private search: SearchPort) {
    super();
  }

  async run(ctx: AgentContext, input: GeoIntelInput): Promise<GeoIntelOutput> {
    const span = ctx.tracer.startSpan({
      name: "agent.geo_intel",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { city: input.city, localities: input.localities },
    });
    const step = this.createStep(
      ctx,
      `Geo intelligence for ${input.city} (${input.localities.length} localities)`,
      input,
      null,
    );

    // Cache lookup: same (city + locality set) returns the prior result.
    // Geo data is slow-changing; 30-day TTL is more than safe for hackathon scale.
    const cacheKey = `${input.city.trim().toLowerCase()}|${[...input.localities].sort().join(",")}`;
    const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
    const hit = ctx.store.geoCache.get<GeoIntelOutput>(cacheKey, CACHE_TTL_MS);
    if (hit) {
      this.completeStep(ctx, step, {
        localities: Object.keys(hit.value.byLocality),
        topOpportunities: hit.value.topOpportunities.length,
        cached: true,
        cachedAt: hit.createdAt,
      });
      span.end({
        status: "ok",
        attributes: {
          localities: Object.keys(hit.value.byLocality).length,
          cached: true,
        },
      });
      return hit.value;
    }

    try {
      const tools: Array<ToolDef<unknown, unknown>> = [
        {
          name: "web_search",
          description:
            "Search the web for local intelligence about an area (landmarks, transit, points of interest, local search-intent keywords). Use queries like '<service> near <area>' or 'best <service> in <area>'.",
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
            return this.search.search(i.query, { maxResults: i.maxResults ?? 6 });
          },
        },
      ];

      const system = `You are the Local Intelligence Agent for an autonomous growth-engineering platform. The target is a ${input.industry} business that serves customers in specific areas.
For each area/locality in the input, you will produce:
- a list of 3-6 nearby landmarks or points of interest relevant to this business's customers (transit, hubs, schools, malls, hospitals, offices),
- a list of 3-6 high-intent local search keywords for a ${input.industry} business (e.g. "${input.industry} near <area>", "best <service> in <area>"),
- 2-4 distinct search intents,
- a tight keyword cluster (5-10 short terms).

For each area you rank as a top opportunity, use web_search ONCE for "<service> <area>" (or "best <service> in <area>") to observe real demand: which competitor sites/pages already rank, and whether there is visible local search activity. Record what you actually observed as evidence — do NOT invent search volumes (we have no volume data).

Then output ONLY a single JSON object matching this schema, no prose:
{
  "byLocality": {
    "<locality>": {
      "locality": "...",
      "city": "...",
      "landmarks": ["..."],
      "searchIntents": ["..."],
      "keywordCluster": ["..."]
    }
  },
  "topOpportunities": [
    {
      "locality": "...",
      "score": 0..100,
      "rationale": "...",
      "evidence": ["competitor X ranks for '<service> <area>'", "N local results for '<service> <area>'"]
    }
  ]
}

The "evidence" array must reflect ONLY what web_search actually returned (competitor domains seen, result counts, SERP observations). If you ran no search for an area, leave its evidence empty — never fabricate demand figures.`;

      const userPrompt = `City: ${input.city}
Target site: ${input.siteUrl}
Localities detected on the site: ${input.localities.length > 0 ? input.localities.join(", ") : "(none — propose 3-4 high-value localities for this city)"}

Research and produce the JSON. Top opportunities should be ranked by SEO upside (localities with strong intent but missing landing pages get higher scores).`;

      const { text } = await this.toolLoop(ctx, span, {
        system,
        userPrompt,
        tools,
        maxRounds: 3,
      });

      const parsed = this.parseJson(text);
      if (!parsed)
        throw new Error("Geo agent did not return valid JSON output");

      // Populate cache for future runs on the same city + localities.
      ctx.store.geoCache.set(cacheKey, input.city.trim().toLowerCase(), parsed);

      this.completeStep(ctx, step, {
        localities: Object.keys(parsed.byLocality),
        topOpportunities: parsed.topOpportunities.length,
      });
      span.end({
        status: "ok",
        attributes: {
          localities: Object.keys(parsed.byLocality).length,
        },
      });
      return parsed;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      throw e;
    }
  }

  private parseJson(text: string): GeoIntelOutput | null {
    // Extract the first JSON object from the response.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(text.slice(start, end + 1)) as GeoIntelOutput;
    } catch {
      return null;
    }
  }
}
