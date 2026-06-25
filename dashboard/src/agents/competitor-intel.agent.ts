import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import { AGENTS } from "@growth/shared/constants";
import type { SearchPort } from "@/core/ports/search.port";

/**
 * A topic competitors own a dedicated page for. The headline competitor-gap
 * insight: "Redfin owns a 'coming soon homes' page, you don't." `onSite` is the
 * model's hint at whether the target already covers it — the pipeline re-checks
 * this deterministically against the crawl, so a hallucinated "you don't cover it"
 * can't slip a false gap through.
 */
export interface CompetitorGap {
  /** The topic/entity competitors build a dedicated page around. */
  topic: string;
  /** Competitor domains observed to own a dedicated page/section for it. */
  ownedBy: string[];
  /** Observed evidence (competitor page titles/URLs actually returned by search). */
  evidence: string[];
  /** Model's hint: does the target site already cover this? Re-verified downstream. */
  onSite: boolean;
}

export interface CompetitorIntelInput {
  siteUrl: string;
  industry: string;
  locationBased: boolean;
  city?: string | null;
  /** Competitor domains surfaced by demand validation — a seed, not the full set. */
  seedCompetitors: string[];
  /** Topics/entities the target already covers or mentions (for the onSite hint). */
  siteTopics: string[];
}

export interface CompetitorIntelOutput {
  /** The business's competitive set, strongest-first (observed domains only). */
  competitors: string[];
  /** Competitor-owned topics — net-new gaps + reinforcement of ones the site mentions. */
  gaps: CompetitorGap[];
}

/** Bound cost/latency: a handful of competitors and topics is plenty for a report. */
const MAX_COMPETITORS = 6;
const MAX_GAPS = 8;

/**
 * Competitor Intelligence agent. Turns "you mention Bayut" into "competitors A,
 * B, C own a dedicated Bayut page — and they also own 'coming soon homes', which
 * you don't cover at all." It (1) confirms the real competitor set from the seed
 * domains demand validation surfaced, then (2) observes which commercially
 * valuable topics those competitors build dedicated pages around.
 *
 * Same honesty contract as the geo/demand agents: every competitor domain and
 * page is OBSERVED via web_search — it never fabricates a competitor, a page, or
 * a ranking. A topic with no observed competitor page is dropped, not guessed.
 */
export class CompetitorIntelAgent extends BaseAgent<
  CompetitorIntelInput,
  CompetitorIntelOutput
> {
  readonly name = "competitor_intel" as const;
  readonly title = AGENTS.competitor_intel.displayName;
  readonly model = AGENTS.competitor_intel.model;

  constructor(private search: SearchPort) {
    super();
  }

  async run(
    ctx: AgentContext,
    input: CompetitorIntelInput,
  ): Promise<CompetitorIntelOutput> {
    const span = ctx.tracer.startSpan({
      name: "agent.competitor_intel",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { siteUrl: input.siteUrl, seeds: input.seedCompetitors },
    });
    const step = this.createStep(ctx, "Competitor gap analysis", input, null);

    try {
      const siteHost = hostOf(input.siteUrl);
      const tools: Array<ToolDef<unknown, unknown>> = [
        {
          name: "web_search",
          description:
            "Search the web to observe competitors and the dedicated pages/topics they own. Use queries like 'best <industry> <city>', '<competitor> features', '<competitor> integrations', or '<topic> <industry>'.",
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
              maxResults: i.maxResults ?? 7,
            });
            return results
              .filter((r) => hostOf(r.url) !== siteHost)
              .map((r) => ({ domain: hostOf(r.url), title: r.title, url: r.url }));
          },
        },
      ];

      const where = input.locationBased && input.city ? ` operating in ${input.city}` : "";
      const system = `You are the Competitor Intelligence Agent for an autonomous growth-engineering platform. The target is a ${input.industry} business${where}. Your job is to find what COMPETITORS build dedicated pages for that the target should — the most persuasive finding in an SEO report ("3 competitors own a dedicated <topic> page, you don't").

Do TWO things:
1. Confirm the competitor set (3-6 real competing companies in this industry${where}). Start from the seed domains provided; use web_search to confirm/expand. List domains you actually observe.
2. Find commercially valuable TOPICS those competitors own dedicated pages/sections for (product features, integrations, named programs, high-intent service or location pages). For each, record which competitor domains you observed owning it and the evidence (the page title/URL seen).

Then mark onSite=true if the target site already appears to cover the topic (it is in the "site already covers" list), false if it looks net-new. Be conservative: when unsure, set onSite=false (the platform re-verifies against the crawl anyway).

SEARCH BUDGET: use AT MOST 5 web_search calls total. As soon as you have enough to name the competitors and a few well-evidenced topics, STOP searching and output the JSON. Do NOT keep searching for completeness — a focused answer from 3-5 searches is the goal. Your FINAL message must be the JSON object, nothing else.

CRITICAL HONESTY RULES:
- "ownedBy" and "evidence" must reflect ONLY what web_search actually returned. Never invent a competitor, a page, or a domain. Never include the target's own domain.
- A topic with no observed competitor page must be omitted entirely. Quality over quantity — 3 well-evidenced gaps beat 8 guesses.

Output ONLY a single JSON object, no prose:
{
  "competitors": ["domain.com", "..."],
  "gaps": [
    {
      "topic": "coming soon homes",
      "ownedBy": ["redfin.com"],
      "evidence": ["Redfin has a dedicated 'Coming Soon Homes' landing page"],
      "onSite": false
    }
  ]
}`;

      const siteTopics = input.siteTopics.slice(0, 40);
      const userPrompt = `Target site: ${input.siteUrl}
Business: ${input.industry}${where}
Seed competitor domains (from demand research): ${input.seedCompetitors.length > 0 ? input.seedCompetitors.join(", ") : "(none — discover them)"}

The target site already covers / mentions these topics (use for the onSite flag):
${siteTopics.length > 0 ? siteTopics.map((t) => `- ${t}`).join("\n") : "(unknown)"}

Research with web_search and produce the JSON. Prioritise net-new, high-intent topics multiple competitors own.`;

      // Headroom over the 5-search budget so the model gets a round to emit JSON
      // after its last search (otherwise the loop can return mid-search).
      const { text } = await this.toolLoop(ctx, span, {
        system,
        userPrompt,
        tools,
        maxRounds: 9,
        maxTokens: 4096,
      });

      const parsed = this.parse(text, siteHost);

      this.completeStep(ctx, step, {
        competitors: parsed.competitors,
        gaps: parsed.gaps.length,
        netNew: parsed.gaps.filter((g) => !g.onSite).length,
      });
      span.end({
        status: "ok",
        attributes: { competitors: parsed.competitors.length, gaps: parsed.gaps.length },
      });
      return parsed;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      throw e;
    }
  }

  private parse(text: string, siteHost: string): CompetitorIntelOutput {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return { competitors: [], gaps: [] };
    let obj: { competitors?: unknown[]; gaps?: Array<Record<string, unknown>> };
    try {
      obj = JSON.parse(text.slice(start, end + 1));
    } catch {
      return { competitors: [], gaps: [] };
    }

    const competitors = Array.isArray(obj.competitors)
      ? dedupe(
          obj.competitors
            .map((d) => normDomain(String(d)))
            .filter((d) => d && d !== siteHost),
        ).slice(0, MAX_COMPETITORS)
      : [];

    const gaps: CompetitorGap[] = [];
    for (const raw of obj.gaps ?? []) {
      const topic = String(raw.topic ?? "").trim();
      if (!topic) continue;
      const ownedBy = Array.isArray(raw.ownedBy)
        ? dedupe(
            raw.ownedBy
              .map((d) => normDomain(String(d)))
              .filter((d) => d && d !== siteHost),
          ).slice(0, 5)
        : [];
      const evidence = Array.isArray(raw.evidence)
        ? raw.evidence.map((e) => String(e).trim()).filter(Boolean).slice(0, 3)
        : [];
      // A gap with no observed competitor owner is a guess — drop it.
      if (ownedBy.length === 0 || evidence.length === 0) continue;
      gaps.push({ topic, ownedBy, evidence, onSite: Boolean(raw.onSite) });
    }

    return { competitors, gaps: gaps.slice(0, MAX_GAPS) };
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Normalize a model-supplied domain ("https://www.Redfin.com/x" → "redfin.com"). */
function normDomain(s: string): string {
  const t = s.trim().toLowerCase();
  if (!t) return "";
  try {
    if (t.startsWith("http")) return hostOf(t);
  } catch {
    /* fall through */
  }
  return t.replace(/^www\./, "").replace(/\/.*$/, "");
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
