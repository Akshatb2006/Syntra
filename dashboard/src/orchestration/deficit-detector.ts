import type {
  BusinessProfile,
  Finding,
  SuggestionEvidence,
  SuggestionImpact,
  SuggestionCategory,
  CrawledPage,
  LighthouseDiagnostic,
} from "@growth/shared/types";
import type { CrawlSeoOutput } from "@/agents/crawl-seo.agent";
import type { GeoIntelOutput } from "@/agents/geo-intel.agent";

/**
 * Deterministic deficit detector. Turns crawl + Lighthouse + geo data into
 * evidence-backed Findings BEFORE any LLM is involved. Every Finding carries
 * MEASURED evidence (a real tag list, a real byte count, a real canonical
 * mismatch) — the orchestrator may rank and phrase findings but may not invent
 * or alter their evidence. This is what makes Syntra deficit-centric ("here is
 * the gap, here is the proof") instead of recommendation-centric.
 */
/**
 * Version of the deficit detector ruleset. Bump this whenever a detector is
 * added/removed, a threshold (e.g. MIN_KIB_SAVINGS) moves, or confidence policy
 * changes — i.e. whenever the SAME site could now yield different findings.
 * Stamped onto every Run so historical audits stay reproducible and the set of
 * findings a run shows is traceable to the rules that were live when it ran.
 */
export const DETECTOR_VERSION = "v4";

export interface DetectorInput {
  crawl: CrawlSeoOutput;
  geo: GeoIntelOutput;
  profile: BusinessProfile;
}

/**
 * A finding before its confidence is computed. Detectors emit these; confidence
 * is derived centrally in `detectDeficits` so the policy lives in one place and
 * stays consistent across every detector.
 */
type DraftFinding = Omit<Finding, "confidence">;

const MAX_PER_DETECTOR = 5;

// A Lighthouse "opportunity" audit (one that reports an estimated saving) is
// only worth a card if the saving is large enough to matter. Below this, items
// like "Minify CSS — 4 KiB" are noise, not findings. Binary pass/fail audits
// (color-contrast, heading-order, document-title) report no saving and are
// never gated by these thresholds.
const MIN_KIB_SAVINGS = 15;
const MIN_MS_SAVINGS = 100;

/**
 * Per-entity-kind tiers for content-gap findings. `scoreWeight` dampens the
 * priority seed (locations are noisy and over-mentioned, so they must rank below
 * commercial entities even when they appear on many pages); `confFloor`/`confCap`
 * set the confidence band (integration/product gaps are the most certain, location
 * gaps the least). "service" covers discrete named programs (Compass's "Private
 * Exclusives", "Compass Cares") — high-value, buildable, so it sits near brand.
 */
const GAP_KIND_TIER: Record<
  string,
  { scoreWeight: number; confFloor: number; confCap: number }
> = {
  integration: { scoreWeight: 1.0, confFloor: 0.86, confCap: 0.95 },
  product: { scoreWeight: 1.0, confFloor: 0.86, confCap: 0.95 },
  service: { scoreWeight: 0.97, confFloor: 0.8, confCap: 0.9 },
  brand: { scoreWeight: 0.95, confFloor: 0.77, confCap: 0.9 },
  location: { scoreWeight: 0.72, confFloor: 0.58, confCap: 0.75 },
  other: { scoreWeight: 0.6, confFloor: 0.55, confCap: 0.7 },
};

export function detectDeficits(input: DetectorInput, detectedAt = Date.now()): Finding[] {
  const { crawl, geo, profile } = input;
  const pages = crawl.crawl.pages.filter((p) => p.status >= 200 && p.status < 400);
  const framework = crawl.framework;

  const drafts: DraftFinding[] = [
    ...detectMetadata(pages, framework),
    ...detectSocial(pages, framework),
    ...detectCanonical(pages, framework),
    ...detectHeadings(pages, framework),
    ...detectAlt(pages, framework),
    ...detectSchema(pages, profile, framework),
    ...detectSitemapRobots(crawl),
    ...detectContentGaps(crawl, profile),
    ...detectLighthouse(crawl.baseline.url, crawl.baseline.diagnostics),
    ...detectLocalityPages(crawl, geo, profile),
  ];

  // Attach a derived confidence and stamp every piece of evidence with the
  // detection time, so each finding carries a complete provenance trail
  // (source + page + measurement + when + how-sure).
  const findings: Finding[] = drafts.map((d) => {
    for (const e of d.evidence) e.detectedAt = detectedAt;
    // Round to 2 dp so tiered confidences read as clean values (0.82, not
    // 0.8200000000000001) wherever they surface.
    return { ...d, confidence: Math.round(confidenceFor(d) * 100) / 100 };
  });

  // Stable highest-first ordering so the orchestrator sees the strongest
  // deficits first even if it ignores scores.
  return findings.sort((a, b) => b.baseScore - a.baseScore);
}

/**
 * Derive how sure we are a deficit is real from HOW it was observed — not from
 * its impact. Direct observations of the page (a tag is present or it isn't, a
 * canonical string mismatches, a byte count from Lighthouse) are near-certain.
 * Inferred findings that combine independent signals (locality demand =
 * classification + demand evidence + coverage analysis) are lower because they
 * have more moving parts. Each extra independent demand signal raises confidence.
 */
function confidenceFor(f: DraftFinding): number {
  const sources = new Set(f.evidence.map((e) => e.source));
  if (f.category === "locality_page") {
    // First evidence line is always "no page targets X"; anything beyond it is an
    // independent demand signal. 0 extra → score-only inference (weakest).
    const demandSignals = Math.max(0, f.evidence.length - 1);
    return Math.min(0.85, 0.6 + demandSignals * 0.06);
  }
  if (f.category === "content_gap") {
    // Inferred from classification + measured mention frequency. The mention
    // counts are facts, but "this should be a page" is a judgement — so it sits
    // below direct DOM facts. Confidence is TIERED BY ENTITY KIND: a commercial
    // integration/product/brand gap is far less noisy than a location mention
    // (a location-based business mentions its city everywhere), so locations get
    // a much lower band. Each extra evidence line nudges within the band.
    const tier = GAP_KIND_TIER[f.entityKind ?? "other"] ?? GAP_KIND_TIER.other;
    const extra = Math.max(0, f.evidence.length - 1);
    return Math.min(tier.confCap, tier.confFloor + extra * 0.05);
  }
  // Lighthouse: measured, but an estimate/model — just below direct DOM facts.
  if (sources.has("lighthouse") && !sources.has("crawl")) return 0.95;
  // Direct crawl observation of the served HTML — a fact, not an inference.
  return 0.99;
}

// --- helpers -------------------------------------------------------------

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

/**
 * Best-effort guess of the source file for a route. Assumes Next.js App Router
 * (the platform's primary target); for other frameworks we still return a
 * route-shaped hint the Code Modification agent can resolve against the repo.
 */
function routeToFile(url: string, framework: string | null): string {
  const p = pathOf(url);
  const isNext = !framework || /next/i.test(framework);
  if (!isNext) return p === "/" ? "(home route)" : `(route ${p})`;
  if (p === "/") return "src/app/page.tsx";
  return `src/app${p}/page.tsx`;
}

/** Rank pages so per-detector caps keep the most important pages. */
function byImportance(pages: CrawledPage[]): CrawledPage[] {
  return [...pages].sort((a, b) => {
    const ah = pathOf(a.url) === "/" ? 1 : 0;
    const bh = pathOf(b.url) === "/" ? 1 : 0;
    if (ah !== bh) return bh - ah;
    return b.wordCount - a.wordCount;
  });
}

function ev(
  source: SuggestionEvidence["source"],
  detail: string,
  url?: string,
): SuggestionEvidence {
  return { source, detail, url };
}

// --- crawl-based detectors ----------------------------------------------

function detectMetadata(pages: CrawledPage[], fw: string | null): DraftFinding[] {
  const out: DraftFinding[] = [];
  for (const p of byImportance(pages)) {
    if (out.length >= MAX_PER_DETECTOR) break;
    const missing: string[] = [];
    if (!p.title || !p.title.trim()) missing.push("title");
    if (!p.description || !p.description.trim()) missing.push("meta description");
    if (missing.length === 0) continue;
    out.push({
      category: "metadata",
      issue: `Missing ${missing.join(" + ")} on ${pathOf(p.url)}`,
      evidence: [
        ev(
          "crawl",
          `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} empty (title=${JSON.stringify(p.title)}, description=${JSON.stringify(p.description)})`,
          p.url,
        ),
      ],
      expectedImpact: missing.includes("title") ? "high" : "medium",
      risk: "low",
      baseScore: missing.includes("title") ? 86 : 78,
      suggestedTitle: `Add ${missing.join(" + ")} to ${pathOf(p.url)}`,
      suggestedImplementation: `Set the page's ${missing.join(" and ")} via the framework's metadata mechanism.`,
      targetFiles: [routeToFile(p.url, fw)],
    });
  }
  return out;
}

function detectSocial(pages: CrawledPage[], fw: string | null): DraftFinding[] {
  const out: DraftFinding[] = [];
  for (const p of byImportance(pages)) {
    if (out.length >= MAX_PER_DETECTOR) break;
    const og = p.ogTags ?? {};
    const tw = p.twitterTags ?? {};
    const ogKeys = Object.keys(og);
    const twKeys = Object.keys(tw);
    const missing: string[] = [];
    if (!("og:title" in og)) missing.push("og:title");
    if (!("og:image" in og)) missing.push("og:image");
    if (!("og:description" in og)) missing.push("og:description");
    if (twKeys.length === 0) missing.push("twitter:card");
    // Only flag pages that are at least partially social-aware or important;
    // a page with zero OG and zero importance isn't worth a card.
    if (missing.length === 0) continue;
    out.push({
      category: "metadata",
      issue: `Incomplete social metadata on ${pathOf(p.url)}`,
      evidence: [
        ev(
          "crawl",
          `present OG tags: [${ogKeys.join(", ") || "none"}]; present Twitter tags: [${twKeys.join(", ") || "none"}]; missing: ${missing.join(", ")}`,
          p.url,
        ),
      ],
      expectedImpact: "medium",
      risk: "low",
      baseScore: 72,
      suggestedTitle: `Add OpenGraph + Twitter Card tags to ${pathOf(p.url)}`,
      suggestedImplementation: `Add ${missing.join(", ")} to the page metadata so shared links render rich previews.`,
      targetFiles: [routeToFile(p.url, fw)],
    });
  }
  return out;
}

function detectCanonical(pages: CrawledPage[], fw: string | null): DraftFinding[] {
  const out: DraftFinding[] = [];
  for (const p of pages) {
    if (out.length >= MAX_PER_DETECTOR) break;
    if (!p.canonical) continue;
    let canon: string;
    let served: string;
    try {
      const c = new URL(p.canonical, p.url);
      const s = new URL(p.url);
      canon = c.origin + c.pathname.replace(/\/+$/, "");
      served = s.origin + s.pathname.replace(/\/+$/, "");
    } catch {
      continue;
    }
    // Mismatch in trailing slash or path → a real canonicalization bug.
    if (canon === served) {
      // Identical after normalization but raw differs only by trailing slash:
      const rawCanon = p.canonical.replace(/\/+$/, "");
      const rawServed = p.url.replace(/\/+$/, "");
      if (rawCanon === rawServed) continue;
      out.push({
        category: "metadata",
        issue: `Canonical trailing-slash mismatch on ${pathOf(p.url)}`,
        evidence: [
          ev("crawl", `canonical = ${p.canonical}, served URL = ${p.url}`, p.url),
        ],
        expectedImpact: "medium",
        risk: "low",
        baseScore: 70,
        suggestedTitle: `Resolve canonical trailing-slash mismatch on ${pathOf(p.url)}`,
        suggestedImplementation:
          "Align the canonical URL and the served URL (consistent trailing-slash policy).",
        targetFiles: [routeToFile(p.url, fw)],
      });
      continue;
    }
    out.push({
      category: "metadata",
      issue: `Canonical points to a different URL on ${pathOf(p.url)}`,
      evidence: [
        ev("crawl", `canonical = ${p.canonical}, served URL = ${p.url}`, p.url),
      ],
      expectedImpact: "medium",
      risk: "low",
      baseScore: 71,
      suggestedTitle: `Fix canonical on ${pathOf(p.url)}`,
      suggestedImplementation:
        "Point the canonical at the page's own URL unless it is a deliberate duplicate.",
      targetFiles: [routeToFile(p.url, fw)],
    });
  }
  return out;
}

function detectHeadings(pages: CrawledPage[], fw: string | null): DraftFinding[] {
  const out: DraftFinding[] = [];
  for (const p of byImportance(pages)) {
    if (out.length >= MAX_PER_DETECTOR) break;
    if (p.h1Count === 1) continue;
    const zero = p.h1Count === 0;
    out.push({
      category: "accessibility",
      issue: zero
        ? `Missing H1 on ${pathOf(p.url)}`
        : `Multiple H1s on ${pathOf(p.url)}`,
      evidence: [ev("crawl", `h1Count = ${p.h1Count} (h2Count = ${p.h2Count})`, p.url)],
      expectedImpact: zero ? "high" : "medium",
      risk: "low",
      baseScore: zero ? 77 : 60,
      suggestedTitle: zero
        ? `Add a single H1 to ${pathOf(p.url)}`
        : `Collapse to one H1 on ${pathOf(p.url)}`,
      suggestedImplementation: zero
        ? "Add exactly one descriptive <h1> reflecting the page's primary topic."
        : "Demote secondary <h1>s to <h2>/<h3> so the page has one top-level heading.",
      targetFiles: [routeToFile(p.url, fw)],
    });
  }
  return out;
}

function detectAlt(pages: CrawledPage[], fw: string | null): DraftFinding[] {
  const out: DraftFinding[] = [];
  for (const p of byImportance(pages)) {
    if (out.length >= MAX_PER_DETECTOR) break;
    if (!p.imagesMissingAlt || p.imagesMissingAlt <= 0) continue;
    out.push({
      category: "accessibility",
      issue: `${p.imagesMissingAlt} image(s) missing alt text on ${pathOf(p.url)}`,
      evidence: [ev("crawl", `${p.imagesMissingAlt} <img> without alt attribute`, p.url)],
      expectedImpact: "medium",
      risk: "low",
      baseScore: 63,
      suggestedTitle: `Add alt text to images on ${pathOf(p.url)}`,
      suggestedImplementation:
        "Add descriptive alt attributes to the flagged images (empty alt for purely decorative ones).",
      targetFiles: [routeToFile(p.url, fw)],
    });
  }
  return out;
}

function detectSchema(
  pages: CrawledPage[],
  profile: BusinessProfile,
  fw: string | null,
): DraftFinding[] {
  const out: DraftFinding[] = [];
  const ranked = byImportance(pages);

  // 1. Homepage missing an organization-level entity.
  const home = ranked.find((p) => pathOf(p.url) === "/");
  if (home) {
    const types = home.structuredDataTypes ?? [];
    const orgType = profile.locationBased ? "LocalBusiness" : "Organization";
    if (!types.includes("Organization") && !types.includes("LocalBusiness")) {
      out.push({
        category: "structured_data",
        issue: `No ${orgType} schema on the homepage`,
        evidence: [
          ev(
            "crawl",
            `structuredDataTypes on / = [${types.join(", ") || "none"}]; ${orgType} absent`,
            home.url,
          ),
        ],
        expectedImpact: "high",
        risk: "low",
        baseScore: 80,
        suggestedTitle: `Add ${orgType} schema to the homepage`,
        suggestedImplementation: `Add ${orgType} JSON-LD${profile.locationBased ? " with areaServed" : ""}, logo, and sameAs.`,
        targetFiles: [routeToFile(home.url, fw)],
      });
    }
  }

  // 2. Substantial content/service pages without FAQPage schema.
  let faqCount = 0;
  for (const p of ranked) {
    if (faqCount >= MAX_PER_DETECTOR) break;
    const types = p.structuredDataTypes ?? [];
    if (p.wordCount < 300) continue;
    if (types.includes("FAQPage")) continue;
    out.push({
      category: "structured_data",
      issue: `No FAQPage schema on ${pathOf(p.url)}`,
      evidence: [
        ev(
          "crawl",
          `structuredDataTypes on ${pathOf(p.url)} = [${types.join(", ") || "none"}]; FAQPage absent (${p.wordCount} words of content)`,
          p.url,
        ),
      ],
      expectedImpact: "medium",
      risk: "low",
      baseScore: 68,
      suggestedTitle: `Add FAQPage schema to ${pathOf(p.url)}`,
      suggestedImplementation:
        "Extract genuine Q&A from the page body into FAQPage JSON-LD (do not fabricate Q&A).",
      targetFiles: [routeToFile(p.url, fw)],
    });
    faqCount++;
  }

  // 3. Pages with zero structured data at all (and some content).
  let bare = 0;
  for (const p of ranked) {
    if (bare >= 3) break;
    const types = p.structuredDataTypes ?? [];
    if (types.length > 0) continue;
    if (p.wordCount < 150) continue;
    if (pathOf(p.url) === "/") continue; // covered by #1
    out.push({
      category: "structured_data",
      issue: `No structured data on ${pathOf(p.url)}`,
      evidence: [ev("crawl", `structuredDataTypes on ${pathOf(p.url)} = []`, p.url)],
      expectedImpact: "medium",
      risk: "low",
      baseScore: 64,
      suggestedTitle: `Add relevant schema to ${pathOf(p.url)}`,
      suggestedImplementation: `Add the most relevant of ${profile.schemaTypes.join(", ")} plus BreadcrumbList/WebPage JSON-LD.`,
      targetFiles: [routeToFile(p.url, fw)],
    });
    bare++;
  }

  return out;
}

function detectSitemapRobots(crawl: CrawlSeoOutput): DraftFinding[] {
  const out: DraftFinding[] = [];
  if (!crawl.crawl.sitemapFound) {
    out.push({
      category: "sitemap_robots",
      issue: "No sitemap.xml found",
      evidence: [ev("crawl", "sitemapFound = false during crawl", crawl.crawl.rootUrl)],
      expectedImpact: "medium",
      risk: "low",
      baseScore: 67,
      suggestedTitle: "Add a sitemap.xml",
      suggestedImplementation:
        "Generate a sitemap covering all indexable routes (e.g. app/sitemap.ts in Next.js).",
      targetFiles: ["src/app/sitemap.ts"],
    });
  }
  if (!crawl.crawl.robotsFound) {
    out.push({
      category: "sitemap_robots",
      issue: "No robots.txt found",
      evidence: [ev("crawl", "robotsFound = false during crawl", crawl.crawl.rootUrl)],
      expectedImpact: "low",
      risk: "low",
      baseScore: 50,
      suggestedTitle: "Add a robots.txt",
      suggestedImplementation:
        "Add robots rules that allow crawling and reference the sitemap.",
      targetFiles: ["src/app/robots.ts"],
    });
  }
  return out;
}

// --- content-gap detector (entity coverage) -----------------------------

/**
 * Turn the Site Understanding layer's detected content gaps into findings. A gap
 * is an entity the site leans on (mentioned across several pages) with no
 * dedicated page — the strategic "missing asset" finding a human consultant
 * surfaces and a hygiene-only audit never would. Evidence is MEASURED (mention
 * counts + the pages the entity appears on); the "should be a page" judgement is
 * what keeps confidence below direct DOM facts.
 */
function detectContentGaps(crawl: CrawlSeoOutput, profile: BusinessProfile): DraftFinding[] {
  const gaps = crawl.understanding?.contentGaps ?? [];
  const fw = crawl.framework;
  const out: DraftFinding[] = [];
  for (const g of gaps) {
    if (out.length >= MAX_PER_DETECTOR) break;

    // BUSINESS-MODEL RELEVANCE GATE. Frequency + coverage is not enough — the
    // entity must also fit the business model. A `location` entity on a business
    // that does NOT serve specific places is incidental geography (the city the
    // company is based in, or a place a user named in a question), not a page
    // worth building. Location pages for genuinely location-based businesses are
    // produced by the geo/locality detector instead, so dropping them here never
    // costs a real local-SEO opportunity — it only removes "Create Amsterdam
    // page" noise on SaaS/blog/global sites.
    if (g.kind === "location" && !profile.locationBased) continue;

    const spread = `${g.mentions}× across ${g.pageCount} crawled page${g.pageCount === 1 ? "" : "s"}`;

    let issue: string;
    let lead: string;
    let suggestedTitle: string;
    let suggestedImplementation: string;
    let targetFiles: string[];
    let risk: "low" | "medium";
    let baseScore: number;

    if (g.mode === "promote" && g.ownerPage) {
      // A page already touches the topic but isn't its canonical owner.
      issue = `${g.ownerPage} references "${g.entity}" but doesn't own the topic`;
      lead = `"${g.entity}" (${g.kind}) is referenced ${spread}, but ${g.ownerPage} — the page closest to it — doesn't own the topic (its slug/title don't match the entity)`;
      suggestedTitle = `Promote ${g.ownerPage} into the canonical "${g.entity}" page`;
      suggestedImplementation = `Make ${g.ownerPage} the canonical owner of "${g.entity}": align its title, H1, URL and canonical to the entity, expand the copy to fully cover it, add relevant schema, and consolidate internal links to it. Do not create a competing page.`;
      targetFiles = [routeToFile(g.ownerPage, fw), "src/app/sitemap.ts"];
      risk = "low"; // editing an existing page is safer than shipping a new one
      baseScore = Math.min(84, 56 + g.pageCount * 4 + Math.min(10, g.mentions));
    } else if (g.mode === "expand" && g.ownerPage) {
      // A dedicated page exists but its coverage is thin relative to demand.
      issue = `Thin coverage of "${g.entity}" on ${g.ownerPage} despite ${g.pageCount}-page demand`;
      lead = `"${g.entity}" (${g.kind}) is referenced ${spread}; ${g.ownerPage} owns it but its coverage is thin relative to that demand`;
      suggestedTitle = `Expand "${g.entity}" coverage on ${g.ownerPage}`;
      suggestedImplementation = `Deepen ${g.ownerPage} so it fully owns "${g.entity}": add supporting content (e.g. setup/migration guides, automation examples, case studies), FAQPage schema, and internal links from the ${g.pageCount} pages that already reference it.`;
      targetFiles = [routeToFile(g.ownerPage, fw)];
      risk = "low";
      baseScore = Math.min(80, 54 + g.pageCount * 4 + Math.min(10, g.mentions));
    } else {
      // create (default): nothing owns the topic.
      const slug = localitySlug(g.entity);
      issue = `No dedicated page for "${g.entity}" despite ${g.pageCount}-page coverage`;
      lead = `"${g.entity}" (${g.kind}) is referenced ${spread}, but no page is dedicated to it`;
      suggestedTitle = `Create a dedicated "${g.entity}" page`;
      suggestedImplementation = `Build a page (and internal links) targeting "${g.entity}" — the site already references it across ${g.pageCount} pages but has no page that owns the topic. Add relevant schema and register it in the sitemap.`;
      targetFiles = [`src/app/${slug}/page.tsx`, "src/app/sitemap.ts"];
      risk = "medium"; // creating a new page/cluster is higher-risk than a tweak
      baseScore = Math.min(86, 58 + g.pageCount * 4 + Math.min(10, g.mentions));
    }

    const evidence: SuggestionEvidence[] = [ev("crawl", lead, crawl.crawl.rootUrl)];
    if (g.samplePages.length > 0) {
      evidence.push(ev("crawl", `appears on: ${g.samplePages.join(", ")}`));
    }

    // Tier by entity kind: dampen the priority seed so a noisy, over-mentioned
    // location can't outrank a commercial brand/integration on page-count alone,
    // and don't let a location claim "high" impact just because it's everywhere.
    const tier = GAP_KIND_TIER[g.kind] ?? GAP_KIND_TIER.other;
    baseScore = Math.round(baseScore * tier.scoreWeight);
    const expectedImpact: SuggestionImpact =
      g.kind === "location" || g.kind === "other"
        ? "medium"
        : g.pageCount >= 4
          ? "high"
          : "medium";

    out.push({
      category: "content_gap",
      issue,
      evidence,
      expectedImpact,
      risk,
      baseScore,
      suggestedTitle,
      suggestedImplementation,
      targetFiles,
      entityKind: g.kind,
      entityName: g.entity,
    });
  }
  return out;
}

// --- Lighthouse-based detectors -----------------------------------------

interface AuditMap {
  category: SuggestionCategory;
  risk: "low" | "medium" | "high";
  base: number;
}

const LH_AUDIT_MAP: Record<string, AuditMap> = {
  // performance
  "unused-javascript": { category: "performance", risk: "medium", base: 74 },
  "unminified-javascript": { category: "performance", risk: "low", base: 70 },
  "unminified-css": { category: "performance", risk: "low", base: 68 },
  "unused-css-rules": { category: "performance", risk: "medium", base: 69 },
  "render-blocking-resources": { category: "performance", risk: "medium", base: 75 },
  "legacy-javascript": { category: "performance", risk: "medium", base: 67 },
  "duplicated-javascript": { category: "performance", risk: "medium", base: 66 },
  "total-byte-weight": { category: "performance", risk: "medium", base: 65 },
  "bootup-time": { category: "performance", risk: "medium", base: 64 },
  "mainthread-work-breakdown": { category: "performance", risk: "medium", base: 63 },
  // images
  "modern-image-formats": { category: "image_optimization", risk: "medium", base: 76 },
  "uses-webp-images": { category: "image_optimization", risk: "medium", base: 76 },
  "uses-optimized-images": { category: "image_optimization", risk: "medium", base: 73 },
  "uses-responsive-images": { category: "image_optimization", risk: "medium", base: 70 },
  "offscreen-images": { category: "image_optimization", risk: "medium", base: 69 },
  "unsized-images": { category: "image_optimization", risk: "low", base: 60 },
  // accessibility
  "color-contrast": { category: "accessibility", risk: "low", base: 66 },
  "heading-order": { category: "accessibility", risk: "low", base: 62 },
  "image-alt": { category: "accessibility", risk: "low", base: 64 },
  "link-name": { category: "accessibility", risk: "low", base: 61 },
  "label": { category: "accessibility", risk: "low", base: 61 },
  "html-has-lang": { category: "accessibility", risk: "low", base: 58 },
  // metadata / crawlability
  "meta-description": { category: "metadata", risk: "low", base: 75 },
  "document-title": { category: "metadata", risk: "low", base: 80 },
  "crawlable-anchors": { category: "internal_linking", risk: "low", base: 62 },
  "is-crawlable": { category: "sitemap_robots", risk: "low", base: 72 },
  "robots-txt": { category: "sitemap_robots", risk: "low", base: 55 },
};

/**
 * Parse a Lighthouse savings string ("Est savings of 129 KiB", "… 1,630 ms",
 * "… 1.6 s") into whether it clears the noise floor. Returns null when the audit
 * reports no saving at all — those are binary pass/fail audits that should NOT be
 * gated by magnitude (they are kept on their own merit).
 */
function savingsSignificance(displayValue?: string): { significant: boolean } | null {
  if (!displayValue) return null;
  const m = displayValue.match(/savings of\s+([\d,.]+)\s*(KiB|MiB|B|ms|s)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!isFinite(n)) return null;
  const unit = m[2].toLowerCase();
  let kib = 0;
  let ms = 0;
  if (unit === "mib") kib = n * 1024;
  else if (unit === "kib") kib = n;
  else if (unit === "b") kib = n / 1024;
  else if (unit === "s") ms = n * 1000;
  else ms = n; // ms
  return { significant: kib >= MIN_KIB_SAVINGS || ms >= MIN_MS_SAVINGS };
}

function impactFromScore(score: number | null): SuggestionImpact {
  if (score === null) return "medium";
  if (score < 0.5) return "high";
  if (score < 0.8) return "medium";
  return "low";
}

function detectLighthouse(
  url: string,
  diagnostics: LighthouseDiagnostic[],
): DraftFinding[] {
  const out: DraftFinding[] = [];
  for (const d of diagnostics) {
    const map = LH_AUDIT_MAP[d.id];
    if (!map) continue; // only surface audits we can describe concretely
    // Drop opportunity audits whose measured saving is below the noise floor
    // ("Minify CSS — 4 KiB"). Binary audits (no reported saving) pass through.
    const sig = savingsSignificance(d.displayValue);
    if (sig && !sig.significant) continue;
    const detail = d.displayValue
      ? `${d.title}: ${d.displayValue}`
      : `${d.title} (Lighthouse audit failing, score ${d.score ?? "n/a"})`;
    out.push({
      category: map.category,
      issue: `${d.title} (Lighthouse: ${url ? pathOf(url) : "homepage"})`,
      evidence: [ev("lighthouse", detail, url)],
      expectedImpact: impactFromScore(d.score),
      risk: map.risk,
      baseScore: map.base,
      suggestedTitle: d.title,
      suggestedImplementation: d.description || `Resolve the "${d.id}" Lighthouse audit.`,
      targetFiles: [],
    });
  }
  // Keep the strongest Lighthouse findings; the rest are noise on most sites.
  return out.sort((a, b) => b.baseScore - a.baseScore).slice(0, 8);
}

// --- geo-gated locality detector ----------------------------------------

function localitySlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function detectLocalityPages(
  crawl: CrawlSeoOutput,
  geo: GeoIntelOutput,
  profile: BusinessProfile,
): DraftFinding[] {
  // Gate 1: only location-based businesses get locality pages at all.
  if (!profile.locationBased) return [];
  const opps = geo.topOpportunities ?? [];
  if (opps.length === 0) return [];

  // Existing coverage: any crawled path or detected locality that already
  // matches the opportunity means the page exists — no finding.
  const existingPaths = crawl.crawl.pages.map((p) => pathOf(p.url).toLowerCase());
  const detected = (crawl.detectedLocalities ?? []).map(localitySlug);

  const out: DraftFinding[] = [];
  for (const opp of opps) {
    if (out.length >= 4) break;
    const slug = localitySlug(opp.locality);
    const covered =
      detected.includes(slug) ||
      existingPaths.some((p) => p.includes(slug));
    if (covered) continue;
    // Gate 2: require an actual demand signal. Without a volume API we accept
    // the geo agent's observed evidence (competitor pages / SERP presence) or a
    // sufficiently strong opportunity score — but never propose on "it's local"
    // alone.
    const demand = (opp.evidence ?? []).filter((e) => e && e.trim());
    if (demand.length === 0 && opp.score < 60) continue;

    const geoCtx = geo.byLocality[opp.locality];
    const evidence: SuggestionEvidence[] = [
      ev("geo", `No existing page targets "${opp.locality}" (not in crawled routes)`),
    ];
    for (const d of demand.slice(0, 3)) evidence.push(ev("geo", d));
    if (demand.length === 0) {
      evidence.push(
        ev("geo", `geo opportunity score ${opp.score}/100 — ${opp.rationale}`),
      );
    }

    out.push({
      category: "locality_page",
      issue: `No landing page targets ${opp.locality} demand`,
      evidence,
      expectedImpact: opp.score >= 75 ? "high" : "medium",
      risk: "medium", // creating new content is higher risk than a metadata tweak
      baseScore: Math.min(88, 55 + Math.round(opp.score * 0.35)),
      suggestedTitle: `Create a ${opp.locality} landing page`,
      suggestedImplementation: geoCtx
        ? `Build a locality page for ${opp.locality} using its intents (${geoCtx.searchIntents.join(", ")}) and landmarks; add LocalBusiness + Service + FAQPage schema and internal links. Register it in the sitemap.`
        : `Build a locality landing page for ${opp.locality} with localized copy, schema, and internal links.`,
      targetFiles: [
        `src/app/${slug}/page.tsx`,
        "src/app/sitemap.ts",
      ],
      geoContext: geoCtx,
    });
  }
  return out;
}
