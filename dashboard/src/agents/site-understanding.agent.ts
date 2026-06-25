import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import type { SpanHandle } from "@/core/ports/tracer.port";
import { AGENTS } from "@growth/shared/constants";
import type {
  BusinessProfile,
  CrawlSiteOutput,
  CrawledPage,
  ContentGap,
  EntityOwnership,
  PageClass,
  RecommendationMode,
  SiteEntity,
  SiteUnderstanding,
} from "@growth/shared/types";
import { EMPTY_SITE_UNDERSTANDING } from "@growth/shared/types";

export interface SiteUnderstandingInput {
  siteUrl: string;
  crawl: CrawlSiteOutput;
  profile: BusinessProfile;
}

/**
 * Site Understanding agent. This is the "website understanding" layer: it turns
 * a flat crawl into a business-aware map of (a) what KINDS of pages the site
 * has, (b) what ENTITIES it talks about, and (c) what it is MISSING. It is the
 * input quality the suggestion generator was starving for — without it a 30-page
 * brokerage reads as "Homepage 1, Other 29" and every recommendation is hygiene.
 *
 * Design:
 *  - Classification is HYBRID: a deterministic regex fast-path types the obvious
 *    pages for free; an LLM derives a business-specific taxonomy and classifies
 *    only the long tail (where Listing/Agent/Neighborhood/Integration live).
 *  - Entity extraction asks the LLM to pick the real named entities out of the
 *    site's headings + link anchors, but mention counts are MEASURED in code so
 *    they remain evidence, never an LLM claim.
 *  - Content-gap detection is fully deterministic: an entity mentioned across
 *    many pages with no dedicated page is a gap.
 *
 * Every LLM step is non-fatal: on any failure the agent degrades to deterministic
 * classification with no entities/gaps rather than failing the run.
 */
export class SiteUnderstandingAgent extends BaseAgent<
  SiteUnderstandingInput,
  SiteUnderstanding
> {
  readonly name = "site_understanding" as const;
  readonly title = AGENTS.site_understanding.displayName;
  readonly model = AGENTS.site_understanding.model;

  async run(
    ctx: AgentContext,
    input: SiteUnderstandingInput,
  ): Promise<SiteUnderstanding> {
    const span = ctx.tracer.startSpan({
      name: "agent.site_understanding",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { siteUrl: input.siteUrl, pages: input.crawl.pages.length },
    });
    const step = this.createStep(
      ctx,
      "Classify pages, extract entities, detect content gaps",
      { siteUrl: input.siteUrl, pages: input.crawl.pages.length },
      null,
    );

    try {
      const pages = input.crawl.pages.filter(
        (p) => p.status >= 200 && p.status < 400,
      );
      if (pages.length === 0) {
        this.completeStep(ctx, step, { mode: "empty", pages: 0 });
        span.end({ status: "ok", attributes: { pages: 0 } });
        return EMPTY_SITE_UNDERSTANDING;
      }

      // 1. Deterministic fast-path: type the obvious pages for free.
      const fastPath = pages.map((p) => ({
        page: p,
        type: classifyByUrl(p.url),
      }));

      // 2. LLM: derive a business-specific taxonomy and classify the long tail
      //    (the pages the fast-path couldn't confidently type).
      let pageClasses: PageClass[] = fastPath.map((f) => ({
        url: f.page.url,
        type: f.type ?? "Other",
        method: f.type ? ("regex" as const) : ("fallback" as const),
      }));
      let taxonomy: string[] = uniq(
        pageClasses.filter((c) => c.method === "regex").map((c) => c.type),
      );
      let mode: SiteUnderstanding["mode"] = "deterministic";

      const unclassified = fastPath.filter((f) => f.type === null);
      if (unclassified.length > 0) {
        try {
          const llm = await this.classifyLongTail(
            ctx,
            span,
            input.profile,
            taxonomy,
            unclassified.map((f) => f.page),
          );
          if (llm) {
            const byUrl = new Map(llm.pages.map((x) => [x.url, x.type]));
            pageClasses = pageClasses.map((c) =>
              byUrl.has(c.url) && byUrl.get(c.url)
                ? { ...c, type: byUrl.get(c.url) as string, method: "llm" as const }
                : c,
            );
            taxonomy = uniq([...taxonomy, ...llm.taxonomy, ...pageClasses.map((c) => c.type)]);
            mode = "llm";
          }
        } catch {
          // keep deterministic classification
        }
      }

      const pageTypes = countTypes(pageClasses);

      // 3. Entities: LLM picks real named entities from the site's headings +
      //    link anchors; we measure their mentions deterministically.
      let entities: SiteEntity[] = [];
      try {
        const names = await this.extractEntityNames(ctx, span, input.profile, pages);
        entities = measureEntities(names, pages);
      } catch {
        entities = [];
      }

      // 4. Content gaps: deterministic. An important entity with no dedicated
      //    page is the strategic finding the generator was missing.
      const contentGaps = detectGaps(entities);

      this.completeStep(ctx, step, {
        mode,
        taxonomy,
        pageTypes,
        entityCount: entities.length,
        contentGapCount: contentGaps.length,
        topEntities: entities.slice(0, 8).map((e) => ({
          name: e.name,
          kind: e.kind,
          pages: e.pages.length,
          ownership: e.ownership,
          coverageDepth: e.coverageDepth,
        })),
      });
      span.end({
        status: "ok",
        attributes: {
          mode,
          pageTypes: pageTypes.length,
          entities: entities.length,
          contentGaps: contentGaps.length,
        },
      });
      return { taxonomy, pageTypes, pageClasses, entities, contentGaps, mode };
    } catch (err) {
      // Non-fatal to the pipeline: understanding is additive. Fall back to a
      // deterministic-only classification so the run still gets page types.
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      const pages = input.crawl.pages.filter((p) => p.status >= 200 && p.status < 400);
      const pageClasses: PageClass[] = pages.map((p) => {
        const t = classifyByUrl(p.url);
        return { url: p.url, type: t ?? "Other", method: t ? "regex" : "fallback" };
      });
      return {
        taxonomy: uniq(pageClasses.map((c) => c.type)),
        pageTypes: countTypes(pageClasses),
        pageClasses,
        entities: [],
        contentGaps: [],
        mode: "deterministic",
      };
    }
  }

  /**
   * One LLM call that does two jobs: propose a compact page-type taxonomy for
   * THIS business, and assign every long-tail page a type from it. Returns null
   * on any parse failure (caller keeps the deterministic classification).
   */
  private async classifyLongTail(
    ctx: AgentContext,
    span: SpanHandle,
    profile: BusinessProfile,
    knownTypes: string[],
    pages: CrawledPage[],
  ): Promise<{ taxonomy: string[]; pages: Array<{ url: string; type: string }> } | null> {
    const sample = pages.slice(0, 40).map((p, i) => {
      const h1 = (p.h1Text ?? []).slice(0, 2).join(" | ");
      return `${i}. ${pathOf(p.url)}  title=${truncate(p.title ?? "", 80)}${h1 ? `  h1=${truncate(h1, 80)}` : ""}`;
    });

    const sells = profile.summary ? ` It is: ${profile.summary}.` : "";
    const audience = profile.audience ? ` Audience: ${profile.audience}.` : "";

    const system = `You classify the pages of a website into a business-specific taxonomy, for an SEO platform that works across ANY industry. The point is to reveal the site's CONTENT ARCHITECTURE — a real-estate brokerage has Listing / Agent / Neighborhood / Market / Office pages; a SaaS has Feature / Integration / Customer / Docs pages; an e-commerce site has Category / Product / Collection pages. Generic buckets like "Other" are a failure — pick a concrete type for each page from how its URL, title and H1 read.

Rules:
- Reuse these already-assigned types where they fit: ${knownTypes.join(", ") || "(none yet)"}.
- Invent SHORT TitleCase type labels appropriate to THIS business (e.g. Listing, Agent, Neighborhood, Market, Office, Project, Integration, Feature, Customer, Category, Product, Service, Location). Keep the whole taxonomy to <= 12 labels.
- Every listed page must get exactly one type. Use "Other" ONLY if a page genuinely fits no coherent type.

Output ONLY JSON (no prose):
{ "taxonomy": ["Type1", "Type2", ...], "pages": [ { "n": 0, "type": "Listing" }, ... ] }`;

    const userPrompt = `BUSINESS: ${profile.industry}${profile.locationBased ? " (location-based)" : ""}.${sells}${audience}

PAGES TO CLASSIFY (n. path  title  h1):
${sample.join("\n")}

Produce the JSON now. Include an entry for every n above.`;

    const { text } = await this.toolLoop(ctx, span, {
      system,
      userPrompt,
      tools: [] as Array<ToolDef<unknown, unknown>>,
      maxRounds: 1,
      maxTokens: 4096,
    });

    const obj = parseJsonObject<{
      taxonomy?: unknown;
      pages?: Array<{ n?: number; type?: string }>;
    }>(text);
    if (!obj || !Array.isArray(obj.pages)) return null;

    const taxonomy = Array.isArray(obj.taxonomy)
      ? obj.taxonomy.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];
    const out: Array<{ url: string; type: string }> = [];
    for (const it of obj.pages) {
      if (typeof it.n !== "number" || typeof it.type !== "string") continue;
      const p = pages[it.n];
      if (!p) continue;
      const type = it.type.trim();
      if (!type) continue;
      out.push({ url: p.url, type });
    }
    if (out.length === 0) return null;
    return { taxonomy, pages: out };
  }

  /**
   * Ask the LLM to pick the real NAMED entities out of the site's distinct
   * headings + link anchors (already short, proper-noun-rich strings). It only
   * returns names + a coarse kind — the counts are measured separately, so the
   * model cannot inflate evidence.
   */
  private async extractEntityNames(
    ctx: AgentContext,
    span: SpanHandle,
    profile: BusinessProfile,
    pages: CrawledPage[],
  ): Promise<Array<{ name: string; kind: string }>> {
    // Build a deduped corpus of the site's salient short strings.
    const phrases = new Map<string, number>();
    const add = (s?: string) => {
      const t = (s ?? "").replace(/\s+/g, " ").trim();
      if (t.length < 2 || t.length > 80) return;
      phrases.set(t, (phrases.get(t) ?? 0) + 1);
    };
    for (const p of pages) {
      add(p.title ?? undefined);
      for (const h of p.h1Text ?? []) add(h);
      for (const h of p.h2Text ?? []) add(h);
      for (const a of p.linkTexts ?? []) add(a);
    }
    // Most-repeated phrases first — repetition is a salience signal.
    const corpus = [...phrases.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(([t]) => t);
    if (corpus.length === 0) return [];

    const system = `You extract the NAMED ENTITIES a website is built around, for an SEO content-gap analysis. From the list of the site's headings and link labels, return the proper-noun entities that the BUSINESS cares about: third-party brands/partners/marketplaces (e.g. Bayut, Property Finder), places/markets (e.g. Nevada, Dubai Marina, Hamptons), products/integrations (e.g. WhatsApp, Salesforce), and named services or programs.

Ignore generic UI words (Home, About, Contact, Login, Search, Menu, Read more), and ignore the client's own brand name.

For each entity give a coarse kind: "brand" | "location" | "product" | "integration" | "service" | "person" | "other".

Output ONLY JSON (no prose), max 30 entities, most important first:
{ "entities": [ { "name": "Bayut", "kind": "brand" }, ... ] }`;

    const userPrompt = `BUSINESS: ${profile.industry}${profile.locationBased ? " (location-based)" : ""}.

SITE HEADINGS & LINK LABELS (deduped, most frequent first):
${corpus.map((c) => `- ${c}`).join("\n")}

Produce the JSON now.`;

    const { text } = await this.toolLoop(ctx, span, {
      system,
      userPrompt,
      tools: [] as Array<ToolDef<unknown, unknown>>,
      maxRounds: 1,
      maxTokens: 2048,
    });

    const obj = parseJsonObject<{ entities?: Array<{ name?: string; kind?: string }> }>(text);
    if (!obj || !Array.isArray(obj.entities)) return [];
    const out: Array<{ name: string; kind: string }> = [];
    const seen = new Set<string>();
    for (const e of obj.entities) {
      if (typeof e.name !== "string") continue;
      const name = e.name.trim();
      if (name.length < 2) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, kind: typeof e.kind === "string" ? e.kind.trim() || "other" : "other" });
    }
    return out;
  }
}

// --- deterministic helpers ----------------------------------------------

/**
 * Confident URL-based page typing. Returns a type only for the universal,
 * unambiguous buckets; returns null for everything else so the LLM can type the
 * business-specific long tail with real context (this is the hybrid split).
 */
export function classifyByUrl(url: string): string | null {
  let seg = "/";
  try {
    seg = new URL(url).pathname.toLowerCase().replace(/\/+$/, "");
  } catch {
    return null;
  }
  if (seg === "" || seg === "/") return "Homepage";
  if (/\/(blog|posts?|news|articles?|stories)(\/|$)/.test(seg)) return "Blog";
  if (/\/(docs?|documentation|guides?|help|support|kb)(\/|$)/.test(seg)) return "Docs";
  if (/\/(pricing|plans?)(\/|$)/.test(seg)) return "Pricing";
  if (/\/(faq|faqs)(\/|$)/.test(seg)) return "FAQ";
  if (/\/(about|company|team|careers?|jobs|contact)(\/|$)/.test(seg)) return "Company";
  return null;
}

function countTypes(classes: PageClass[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of classes) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Turn LLM-proposed entity names into measured SiteEntities: count occurrences
 * across the captured text of every page (word-boundary, case-insensitive) so
 * the mention count is evidence, and decide whether a dedicated page exists.
 */
function measureEntities(
  names: Array<{ name: string; kind: string }>,
  pages: CrawledPage[],
): SiteEntity[] {
  const out: SiteEntity[] = [];
  for (const { name, kind } of names) {
    const re = entityRegex(name);
    if (!re) continue;
    let mentions = 0;
    const onPages: string[] = [];
    for (const p of pages) {
      const hay = [
        p.title ?? "",
        p.description ?? "",
        ...(p.h1Text ?? []),
        ...(p.h2Text ?? []),
        ...(p.linkTexts ?? []),
      ].join("  ·  ");
      const m = hay.match(re);
      if (m && m.length > 0) {
        mentions += m.length;
        onPages.push(p.url);
      }
    }
    if (mentions === 0) continue;
    out.push({
      name,
      kind,
      mentions,
      pages: onPages,
      ...detectOwnership(name, pages),
    });
  }
  // Salience order: breadth of coverage first, then raw mentions.
  return out
    .sort((a, b) => b.pages.length - a.pages.length || b.mentions - a.mentions)
    .slice(0, 25);
}

/**
 * The owning page must clear this word count to count as "sufficient" coverage;
 * below it an owned topic is an EXPAND opportunity, not a quiet pass.
 */
const COVERAGE_DEPTH_MIN_WORDS = 400;

type OwnershipResult = {
  ownership: EntityOwnership;
  ownerPage?: string;
  coverageDepth?: "thin" | "sufficient";
};

/**
 * Grade how fully the site OWNS an entity's topic — the signal that turns a
 * binary "page exists?" into the Create / Promote / Expand decision.
 *
 *  - owned   : a single URL segment IS the entity (e.g. /bayut, /integrations/hubspot).
 *              A substantial owner page = sufficient coverage; a thin one is an
 *              EXPAND opportunity (demand exists, the owned page is shallow).
 *  - partial : a page references the entity and shares its distinctive slug or
 *              heading tokens but isn't the canonical owner (e.g. /whatsapp-os for
 *              "WhatsApp Lead OS") — a PROMOTE opportunity.
 *  - none    : nothing owns the topic on its own surface — a CREATE opportunity.
 */
function detectOwnership(name: string, pages: CrawledPage[]): OwnershipResult {
  const entSlug = slugify(name);
  const entTokens = entSlug.split("-").filter((t) => t.length >= 2);
  if (entTokens.length === 0) return { ownership: "none" };

  // OWNED: a single path segment equals the full entity slug — a clean dedicated
  // page. Its word count decides whether coverage is thin (expand) or sufficient.
  const owner = pages.find((p) => {
    const segs = pathOf(p.url).toLowerCase().split("/").filter(Boolean);
    return segs.some((s) => s === entSlug);
  });
  if (owner) {
    const depth =
      (owner.wordCount ?? 0) >= COVERAGE_DEPTH_MIN_WORDS ? "sufficient" : "thin";
    return { ownership: "owned", ownerPage: pathOf(owner.url), coverageDepth: depth };
  }

  // PARTIAL: a page whose most-specific URL segment is largely ABOUT the entity
  // but isn't its exact slug (e.g. /whatsapp-os for "WhatsApp Lead OS"). The
  // entity must make up a strong MAJORITY of that segment's tokens — so a page
  // that merely mentions the entity as a modifier ("/case-studies/dubai-brokerage-
  // lead-funnel-rebuild" mentioning "Dubai", where dubai is 1 of 5 tokens) is NOT
  // an owner. This is what keeps a brand like Property Finder a CREATE instead of
  // a false "promote the homepage", and a city a CREATE instead of "promote a
  // case study". The homepage (no path segment) is never a specific owner.
  let best: { path: string; coverage: number; shared: number } | null = null;
  for (const p of pages) {
    const segs = pathOf(p.url).toLowerCase().split("/").filter(Boolean);
    if (segs.length === 0) continue;
    const segTokens = segs[segs.length - 1].split("-").filter((t) => t.length >= 2);
    if (segTokens.length === 0) continue;
    const shared = entTokens.filter((t) => segTokens.includes(t));
    if (shared.length === 0) continue;
    const coverage = shared.length / segTokens.length;
    // Distinctive overlap (>=2 tokens, or one >=5 chars) AND the segment is mostly
    // the entity — not the entity buried among other words.
    const distinctive = shared.length >= 2 || shared.some((t) => t.length >= 5);
    if (coverage >= 0.5 && distinctive) {
      if (
        !best ||
        coverage > best.coverage ||
        (coverage === best.coverage && shared.length > best.shared)
      ) {
        best = { path: pathOf(p.url), coverage, shared: shared.length };
      }
    }
  }
  if (best) return { ownership: "partial", ownerPage: best.path };

  return { ownership: "none" };
}

/**
 * Turn entities into content gaps, choosing a recommendation MODE from how fully
 * the site owns each topic. People are excluded (you don't build a page per named
 * individual); generic "other" is excluded as low-signal. An owned-and-deep topic
 * produces NO gap — that's the suppression that keeps the report honest.
 */
function detectGaps(entities: SiteEntity[]): ContentGap[] {
  const GAP_KINDS = new Set(["brand", "location", "product", "integration", "service"]);
  const gaps: ContentGap[] = [];
  for (const e of entities) {
    if (!GAP_KINDS.has(e.kind)) continue;
    // Structurally important: referenced on >=3 pages, or heavily on >=2.
    const important = e.pages.length >= 3 || (e.pages.length >= 2 && e.mentions >= 5);
    if (!important) continue;

    let mode: RecommendationMode;
    if (e.ownership === "none") {
      mode = "create";
    } else if (e.ownership === "partial") {
      mode = "promote";
    } else {
      // owned: only worth surfacing when coverage is thin AND demand is strong —
      // otherwise the topic is sufficiently covered and we stay quiet (no false
      // "expand" on a topic the site already handles well).
      const strongDemand = e.pages.length >= 4 || e.mentions >= 8;
      if (e.coverageDepth !== "thin" || !strongDemand) continue;
      mode = "expand";
    }

    gaps.push({
      entity: e.name,
      kind: e.kind,
      mentions: e.mentions,
      pageCount: e.pages.length,
      samplePages: e.pages.slice(0, 4).map((u) => pathOf(u)),
      mode,
      ownerPage: e.ownerPage,
      reason: gapReason(mode, e),
    });
  }

  // Collapse promote/expand gaps that target the SAME page down to the most
  // specific entity — e.g. "WhatsApp" (×140) and "WhatsApp Lead OS" (×89) both
  // point at /whatsapp-os; keep "WhatsApp Lead OS". Prevents near-duplicate cards
  // for one page and ensures the more specific topic wins the recommendation.
  const byOwner = new Map<string, ContentGap>();
  const result: ContentGap[] = [];
  for (const g of gaps) {
    if ((g.mode === "promote" || g.mode === "expand") && g.ownerPage) {
      const prev = byOwner.get(g.ownerPage);
      if (!prev || gapSpecificity(g) > gapSpecificity(prev)) byOwner.set(g.ownerPage, g);
    } else {
      result.push(g);
    }
  }
  result.push(...byOwner.values());

  return result
    .sort((a, b) => b.pageCount - a.pageCount || b.mentions - a.mentions)
    .slice(0, 6);
}

/** More entity words = more specific topic; tie-break on mention volume. */
function gapSpecificity(g: ContentGap): number {
  const words = g.entity.trim().split(/\s+/).length;
  return words * 1000 + Math.min(999, g.mentions);
}

function gapReason(mode: RecommendationMode, e: SiteEntity): string {
  const spread = `${e.mentions}× across ${e.pages.length} page${e.pages.length === 1 ? "" : "s"}`;
  if (mode === "promote")
    return `Referenced ${spread}; ${e.ownerPage} touches it but doesn't own the topic`;
  if (mode === "expand")
    return `Referenced ${spread}; ${e.ownerPage} owns it but coverage is thin`;
  return `Referenced ${spread} but no page is dedicated to it`;
}

function entityRegex(name: string): RegExp | null {
  const esc = escapeRegExp(name.trim());
  if (!esc) return null;
  try {
    // Word-ish boundaries so "CRM" doesn't match inside "microCRMs"; allow the
    // entity to be a multi-word phrase.
    return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "giu");
  } catch {
    return null;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function parseJsonObject<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
