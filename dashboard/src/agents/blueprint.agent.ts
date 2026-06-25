import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import type { SpanHandle } from "@/core/ports/tracer.port";
import { AGENTS } from "@growth/shared/constants";
import type { BusinessProfile, Suggestion, SuggestionBlueprint } from "@growth/shared/types";

export interface BlueprintInput {
  siteUrl: string;
  profile: BusinessProfile;
  /** Buildable gap suggestions to blueprint (content_gap / locality_page). */
  suggestions: Suggestion[];
}

export interface BlueprintOutput {
  /** suggestion id -> page blueprint. May be partial or empty. */
  byId: Record<string, SuggestionBlueprint>;
}

/** Only entity/locality gaps are "build a page" work worth a blueprint. */
function isBuildable(s: Suggestion): boolean {
  return s.category === "content_gap" || s.category === "locality_page";
}

/**
 * Page Blueprint agent. The last mile that makes a recommendation executable:
 * it turns "Create a Bayut page" into a concrete page outline — title, section
 * structure, and target keyword cluster — that a writer or the Code Modification
 * agent can build from.
 *
 * Invariant (same family as Enrichment): it can ONLY blueprint the gaps it is
 * handed. It never invents a gap, an entity, a competitor, or a demand number —
 * it receives already-proven, already-prioritized gaps and returns an outline per
 * gap, keyed by index. It leans on the gap's demand intent + competitor evidence
 * for relevance. A bad/absent LLM response degrades to un-blueprinted cards.
 */
export class BlueprintAgent extends BaseAgent<BlueprintInput, BlueprintOutput> {
  readonly name = "blueprint" as const;
  readonly title = AGENTS.blueprint.displayName;
  readonly model = AGENTS.blueprint.model;

  async run(ctx: AgentContext, input: BlueprintInput): Promise<BlueprintOutput> {
    const buildable = input.suggestions.filter(isBuildable);
    const span = ctx.tracer.startSpan({
      name: "agent.blueprint",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { siteUrl: input.siteUrl, buildable: buildable.length },
    });
    const step = this.createStep(ctx, "Draft page blueprints for buildable gaps", input, null);

    try {
      if (buildable.length === 0) {
        this.completeStep(ctx, step, { blueprinted: 0, mode: "empty" });
        span.end({ status: "ok", attributes: { blueprinted: 0 } });
        return { byId: {} };
      }

      let byId: Record<string, SuggestionBlueprint> = {};
      try {
        byId = await this.draft(ctx, span, input, buildable);
      } catch {
        // Non-fatal: blueprints are additive. A bad/absent LLM response leaves
        // the gap cards without an outline rather than failing the run.
        byId = {};
      }

      this.completeStep(ctx, step, {
        blueprinted: Object.keys(byId).length,
        of: buildable.length,
      });
      span.end({ status: "ok", attributes: { blueprinted: Object.keys(byId).length } });
      return { byId };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      // Non-fatal to the pipeline — caller treats a throw as "no blueprints".
      return { byId: {} };
    }
  }

  private async draft(
    ctx: AgentContext,
    span: SpanHandle,
    input: BlueprintInput,
    buildable: Suggestion[],
  ): Promise<Record<string, SuggestionBlueprint>> {
    const { profile } = input;
    const sells = profile.summary ? `\nWhat they sell: ${profile.summary}` : "";
    const audience = profile.audience ? `\nAudience: ${profile.audience}` : "";
    const market = profile.locationBased
      ? "\nMarket: location-based (serves specific places)"
      : "\nMarket: not location-specific";

    const gapsBlock = buildable
      .map((s, i) => {
        const d = s.demand;
        const demand = d
          ? `\n  demand: ${d.band} (${d.intent} intent, score ${d.score})${d.competitorsOwning.length ? `; competitors owning a page: ${d.competitorsOwning.join(", ")}` : ""}`
          : "";
        const geo = s.geoContext
          ? `\n  geo: ${s.geoContext.locality} — intents: ${s.geoContext.searchIntents.join(", ")}`
          : "";
        return `#${i} [${s.category}] ${s.title}
  gap: ${s.issue}${demand}${geo}`;
      })
      .join("\n\n");

    const system = `You are a senior SEO content strategist. For each buildable CONTENT GAP below, produce a concrete page BLUEPRINT a writer (or a code agent) can execute — turning "create an X page" into a half-written page.

For EACH gap, output:
- title — the page's <title>/H1: specific, buyer-facing, keyword-bearing, tailored to THIS business (e.g. "Bayut to WhatsApp CRM Integration for Dubai Brokerages", not "Bayut page").
- angle — one sentence on the page's positioning / who it's for.
- sections — 4-7 H2-level section headings in logical order (e.g. lead capture, automation, qualification, integration steps, pricing, FAQ). Concrete, not generic ("How Bayut leads flow into WhatsApp", not "Features").
- keywords — 4-8 target search terms the page should rank for, reflecting the entity + the business's buyers (e.g. "Bayut CRM", "Bayut WhatsApp integration", "Bayut lead automation").
- metaDescription — one <=160-char meta description draft.

GROUND IT in the signals given: use the demand intent and the competitor ownership to shape the angle and keywords (if competitors own a page, position to win the comparison). Be specific to the business's industry, what it sells, and audience.

HARD RULES:
- ONLY blueprint the gaps in the list. Never introduce a new gap, entity, competitor, or number not present above.
- No generic outlines that would fit any site. Tailor every field to THIS business + THIS entity.
- Plain text fields, no markdown. Refer to each gap by its #index.

Output ONLY JSON (no prose):
{ "items": [ { "index": 0, "title": "...", "angle": "...", "sections": ["..."], "keywords": ["..."], "metaDescription": "..." } ] }`;

    const userPrompt = `CLIENT BUSINESS
Industry: ${profile.industry}${sells}${audience}${market}
Site: ${input.siteUrl}

BUILDABLE GAPS TO BLUEPRINT (reference by #index; blueprint every one):

${gapsBlock}

Produce the JSON now.`;

    const { text } = await this.toolLoop(ctx, span, {
      system,
      userPrompt,
      tools: [] as Array<ToolDef<unknown, unknown>>,
      maxRounds: 1,
      maxTokens: 8192,
    });

    return this.parse(text, buildable);
  }

  private parse(
    text: string,
    buildable: Suggestion[],
  ): Record<string, SuggestionBlueprint> {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return {};
    let obj: { items?: Array<Record<string, unknown>> };
    try {
      obj = JSON.parse(text.slice(start, end + 1));
    } catch {
      return {};
    }
    const out: Record<string, SuggestionBlueprint> = {};
    for (const it of obj.items ?? []) {
      if (typeof it.index !== "number") continue;
      const s = buildable[it.index];
      if (!s) continue;
      const title = str(it.title, 140);
      const sections = strList(it.sections, 7);
      const keywords = strList(it.keywords, 8);
      // A blueprint without a title or any sections is not usable — skip it.
      if (!title || sections.length === 0) continue;
      out[s.id] = {
        title,
        angle: str(it.angle, 220) || undefined,
        sections,
        keywords,
        metaDescription: str(it.metaDescription, 180) || undefined,
      };
    }
    return out;
  }
}

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function strList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => str(x, 120))
    .filter(Boolean)
    .slice(0, max);
}
