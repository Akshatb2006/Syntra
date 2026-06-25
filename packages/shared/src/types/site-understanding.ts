/**
 * Site Understanding — the "website understanding" layer that sits between raw
 * crawl signals (HTML, schema, metadata, performance) and the suggestion
 * generator. It answers the questions a human consultant would ask first:
 *
 *   - What KIND of pages does this site have? (content architecture)
 *   - What ENTITIES does it talk about? (brands, partners, locations, products)
 *   - What is it MISSING? (entities mentioned heavily but with no dedicated page)
 *
 * Without this, a 30-page brokerage looks like "Homepage 1, Other 29" and every
 * recommendation is website hygiene. With it, the engine can say "Bayut appears
 * across 18 pages but has no dedicated page" — the kind of finding competitors
 * don't generate. Everything here is derived from the crawl; entity mention
 * counts are MEASURED from captured text, never invented by the LLM.
 */

/** One crawled page assigned a business-specific type. */
export interface PageClass {
  url: string;
  /** Business-aware type, e.g. "Listing", "Agent", "Neighborhood", "Pricing". */
  type: string;
  /** How the type was decided — useful for trust + debugging. */
  method: "regex" | "llm" | "fallback";
}

/**
 * How fully the site OWNS an entity's topic today. This is the signal that turns
 * a binary "does a page exist?" into a strategist's decision:
 *   - "none"    → nothing references the topic on its own surface → CREATE.
 *   - "partial" → a page touches the topic but its slug/title don't make it the
 *                 canonical owner (e.g. /whatsapp-os vs "WhatsApp Lead OS") → PROMOTE.
 *   - "owned"   → a page's URL is the entity. If that page is substantial the topic
 *                 is sufficiently covered (no finding); if thin, it's an EXPAND.
 */
export type EntityOwnership = "none" | "partial" | "owned";

/**
 * What action a content gap recommends, derived from ownership + coverage depth.
 * This is the difference between a rule engine ("create page") and a strategist
 * ("this page exists but isn't actually owning the topic").
 */
export type RecommendationMode = "create" | "promote" | "expand";

/**
 * A named entity the site talks about (a brand/partner like "Bayut", a place
 * like "Nevada", a product/integration like "WhatsApp"). `mentions` and `pages`
 * are counted deterministically from captured page text — they are evidence.
 */
export interface SiteEntity {
  name: string;
  /** Coarse kind: "brand" | "location" | "product" | "integration" | "person" | "other". */
  kind: string;
  /** Total occurrences across captured text (titles, headings, link anchors). */
  mentions: number;
  /** Distinct page URLs the entity appears on. */
  pages: string[];
  /** How fully the site owns this entity's topic (drives the recommendation mode). */
  ownership: EntityOwnership;
  /** The page (path) that fully or partially owns the topic — set when ownership !== "none". */
  ownerPage?: string;
  /** For owned entities: whether the owning page's coverage is thin or sufficient. */
  coverageDepth?: "thin" | "sufficient";
}

/**
 * A content gap: an entity the site mentions repeatedly but doesn't fully own.
 * This is where the strategic, "million-dollar" findings live — the missing
 * asset (create), the un-canonicalized page (promote), or the shallow page that
 * doesn't match demand (expand) — not the missing meta tag.
 */
export interface ContentGap {
  entity: string;
  kind: string;
  /** Measured: total mentions across the crawl. */
  mentions: number;
  /** Measured: how many distinct pages reference it. */
  pageCount: number;
  /** Sample of the pages that reference it (for evidence). */
  samplePages: string[];
  /** Recommended action: create a page, promote an existing one, or expand it. */
  mode: RecommendationMode;
  /** The existing page to promote/expand — set when mode is "promote" or "expand". */
  ownerPage?: string;
  /** Why this is a gap, in one line (deterministic phrasing). */
  reason: string;
}

export interface SiteUnderstanding {
  /** The business-specific page-type vocabulary used to classify this site. */
  taxonomy: string[];
  /** Page-type breakdown across ALL crawled pages — the "Site Understanding" signal. */
  pageTypes: Array<{ type: string; count: number }>;
  /** Per-page classification (powers gap detection + link analysis). */
  pageClasses: PageClass[];
  /** Salient entities the site talks about, strongest-first. */
  entities: SiteEntity[];
  /** Detected content gaps, strongest-first. */
  contentGaps: ContentGap[];
  /** Whether the LLM layer ran ("llm") or we degraded to deterministic-only. */
  mode: "llm" | "deterministic";
}

/** Empty understanding — used when there is nothing to classify. */
export const EMPTY_SITE_UNDERSTANDING: SiteUnderstanding = {
  taxonomy: [],
  pageTypes: [],
  pageClasses: [],
  entities: [],
  contentGaps: [],
  mode: "deterministic",
};
