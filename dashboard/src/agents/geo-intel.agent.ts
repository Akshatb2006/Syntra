import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import { AGENTS } from "@growth/shared/constants";
import type { SearchPort } from "@/core/ports/search.port";
import type { GeoSuggestionContext } from "@growth/shared/types";

export interface GeoIntelInput {
  city: string;
  localities: string[];
  siteUrl: string;
}

export interface GeoIntelOutput {
  byLocality: Record<string, GeoSuggestionContext>;
  topOpportunities: Array<{
    locality: string;
    score: number;
    rationale: string;
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

    try {
      const tools: Array<ToolDef<unknown, unknown>> = [
        {
          name: "web_search",
          description:
            "Search the web for locality intelligence (landmarks, metro, schools, search-intent keywords). Use queries like 'apartments near Whitefield metro' or 'best schools Sarjapur road'.",
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

      const system = `You are the Geo Intelligence Agent for an autonomous growth-engineering platform focused on real-estate websites.
For each locality in the input, you will produce:
- a list of 3-6 nearby landmarks (tech parks, metros, schools, malls, hospitals),
- a list of 3-6 high-intent search keywords (e.g. "2BHK near Whitefield metro", "apartments in Sarjapur near Wipro"),
- 2-4 distinct search intents (rent vs buy, family vs IT, etc.),
- a tight keyword cluster (5-10 short terms).

Use the web_search tool aggressively for accurate, current locality data. Make 2-3 searches per locality.

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
    { "locality": "...", "score": 0..100, "rationale": "..." }
  ]
}`;

      const userPrompt = `City: ${input.city}
Target site: ${input.siteUrl}
Localities detected on the site: ${input.localities.length > 0 ? input.localities.join(", ") : "(none — propose 3-4 high-value localities for this city)"}

Research and produce the JSON. Top opportunities should be ranked by SEO upside (localities with strong intent but missing landing pages get higher scores).`;

      const { text } = await this.toolLoop(ctx, span, {
        system,
        userPrompt,
        tools,
        maxRounds: 8,
      });

      const parsed = this.parseJson(text);
      if (!parsed)
        throw new Error("Geo agent did not return valid JSON output");

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
