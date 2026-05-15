import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import { AGENTS } from "@growth/shared/constants";
import type { Suggestion } from "@growth/shared/types";
import { newId } from "@/lib/id";
import type { CrawlSeoOutput } from "./crawl-seo.agent";
import type { GeoIntelOutput } from "./geo-intel.agent";

export interface OrchestratorInput {
  siteUrl: string;
  crawl: CrawlSeoOutput;
  geo: GeoIntelOutput;
  maxSelected?: number;
}

export interface OrchestratorOutput {
  suggestions: Suggestion[];
  selected: Suggestion[];
  rationale: string;
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
      attributes: { siteUrl: input.siteUrl },
    });
    const step = this.createStep(ctx, "Plan & prioritize", input, null);

    try {
      const tools: Array<ToolDef<unknown, unknown>> = [];
      const system = `You are the Orchestrator Agent for an autonomous growth-engineering platform on real-estate Next.js websites.
You receive an audit narrative + crawl + Lighthouse baseline + geo intelligence. Produce a prioritized list of SEO/growth suggestions, each implementable as a single PR by a downstream Code Modification agent that uses Claude Code on a feature branch.

Output ONLY JSON (no prose) matching:
{
  "suggestions": [
    {
      "id": "sug_xxx",
      "category": "metadata|schema|internal_linking|locality_page|performance|image_optimization|content_quality|accessibility|structured_data|sitemap_robots",
      "title": "short, action-shaped",
      "description": "what to change, where",
      "rationale": "why it matters for SEO/growth",
      "expectedImpact": "low|medium|high",
      "risk": "low|medium|high",
      "priorityScore": 0..100,
      "targetFiles": ["src/app/listings/[slug]/page.tsx", ...],
      "geoContext": { "locality": "...", "city": "...", "landmarks": [...], "searchIntents": [...], "keywordCluster": [...] }  // OPTIONAL — only for locality_page or geo-heavy suggestions
    }
  ],
  "selected": [<ids picked for autonomous dispatch — ${input.maxSelected ?? 3} max, highest priority/lowest risk first>],
  "rationale": "1-2 sentences on why these were selected"
}

Selection rules:
- Pick suggestions with high impact and low risk first.
- Avoid suggestions that depend on third-party data we don't have (analytics, search console).
- Each selected suggestion must be implementable in <=6 files.
- Diversify categories where possible (don't pick 3 metadata fixes).
- Prefer locality_page if geo opportunities are strong.`;

      const userPrompt = `SITE: ${input.siteUrl}

AUDIT NARRATIVE:
${input.crawl.auditNarrative}

LIGHTHOUSE BASELINE:
${JSON.stringify(input.crawl.baseline.scores)}

CRAWL SUMMARY:
- pages crawled: ${input.crawl.crawl.pages.length}
- framework: ${input.crawl.framework}
- sitemap found: ${input.crawl.crawl.sitemapFound}
- robots found: ${input.crawl.crawl.robotsFound}
- detected localities on site: ${input.crawl.detectedLocalities.join(", ") || "(none)"}

GEO INTELLIGENCE:
\`\`\`json
${JSON.stringify(input.geo, null, 2).slice(0, 8000)}
\`\`\`

Produce the JSON now.`;

      const { text } = await this.toolLoop(ctx, span, {
        system,
        userPrompt,
        tools,
        maxRounds: 2,
      });

      const parsed = this.parseJson(text);
      if (!parsed) throw new Error("Orchestrator returned invalid JSON");

      // Materialize IDs and runId, normalize status.
      const suggestions: Suggestion[] = parsed.suggestions.map((s) => ({
        ...s,
        id: s.id?.startsWith("sug_") ? s.id : newId("sug"),
        runId: ctx.runId,
        status: "proposed" as const,
        dispatchJobId: null,
        prNumber: null,
      }));
      const selectedIds = new Set(parsed.selected ?? []);
      const selected = suggestions
        .filter((s) => selectedIds.has(s.id))
        .map((s) => ({ ...s, status: "selected" as const }));

      // Replace suggestions with merged status for the selected ones.
      const idMap = new Map(selected.map((s) => [s.id, s]));
      const merged = suggestions.map((s) => idMap.get(s.id) ?? s);

      ctx.store.suggestions.insertMany(merged);
      for (const s of merged) {
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
        proposed: merged.length,
        selected: selected.length,
      });
      span.end({
        status: "ok",
        attributes: { proposed: merged.length, selected: selected.length },
      });
      return { suggestions: merged, selected, rationale: parsed.rationale ?? "" };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      throw e;
    }
  }

  private parseJson(text: string): {
    suggestions: Array<Omit<Suggestion, "runId" | "status" | "dispatchJobId" | "prNumber">>;
    selected: string[];
    rationale: string;
  } | null {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      const obj = JSON.parse(text.slice(start, end + 1)) as {
        suggestions: Array<Omit<Suggestion, "runId" | "status" | "dispatchJobId" | "prNumber">>;
        selected?: string[];
        rationale?: string;
      };
      return {
        suggestions: obj.suggestions ?? [],
        selected: obj.selected ?? [],
        rationale: obj.rationale ?? "",
      };
    } catch {
      return null;
    }
  }
}
