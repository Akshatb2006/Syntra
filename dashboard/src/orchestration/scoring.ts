import type { Finding, OpportunityScore, SuggestionCategory } from "@growth/shared/types";

/**
 * Opportunity scoring v2 — the deterministic prioritization model. Instead of
 * letting the LLM pick one opaque priority number, we DECOMPOSE every finding
 * into the dimensions a buyer actually weighs — business value, validated demand,
 * the competitive gap, implementation cost, evidence strength — and compose a
 * transparent priority from them. Every input is measured upstream (demand/geo/
 * competitor agents + the deterministic detector), so the ranking is reproducible
 * and explainable on the card ("why is this #1?").
 */

/** The four families a senior audit balances across. */
export type Family = "business" | "technical" | "performance" | "accessibility";

export const CATEGORY_FAMILY: Record<SuggestionCategory, Family> = {
  // Revenue / growth opportunities — the differentiators.
  content_gap: "business",
  locality_page: "business",
  internal_linking: "business",
  content_quality: "business",
  // Structural SEO — necessities, not differentiators.
  metadata: "technical",
  schema: "technical",
  structured_data: "technical",
  sitemap_robots: "technical",
  // Technical performance.
  performance: "performance",
  image_optimization: "performance",
  // Accessibility & compliance.
  accessibility: "accessibility",
};

export const FAMILIES: Family[] = ["business", "technical", "performance", "accessibility"];

/**
 * Business-value floor per family. A growth opportunity (a competitor-owned
 * content gap) is worth more revenue than an accessibility nit even before any
 * other signal — this seeds the impact axis.
 */
const FAMILY_IMPACT_BASE: Record<Family, number> = {
  business: 75,
  technical: 55,
  performance: 50,
  accessibility: 45,
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Score a finding across all opportunity dimensions and compose its priority.
 * Pure + deterministic. Sub-scores that don't apply to a finding (demand/
 * competitive gap on a hygiene fix) are 0 and simply don't enter its upside.
 */
export function scoreOpportunity(f: Finding): OpportunityScore {
  const family = CATEGORY_FAMILY[f.category];
  const isGap = f.category === "content_gap" || f.category === "locality_page";

  // --- Impact (business value / revenue potential) ---
  let impact = FAMILY_IMPACT_BASE[family];
  impact += f.expectedImpact === "high" ? 15 : f.expectedImpact === "low" ? -15 : 0;
  if (f.demand) {
    // Commercial intent is money; a regulatory/compliance mention is not.
    impact +=
      f.demand.intent === "commercial"
        ? 10
        : f.demand.intent === "regulatory"
          ? -25
          : f.demand.intent === "informational"
            ? -10
            : 0;
  }
  impact = clamp(impact);

  // --- Demand (validated search interest) ---
  const demand = f.demand ? clamp(f.demand.score) : 0;

  // --- Competitive gap (how much competitors own this that you don't) ---
  const comps = f.demand?.competitorsOwning.length ?? 0;
  const competitiveGap = comps === 0 ? 0 : comps === 1 ? 50 : comps === 2 ? 70 : 85;

  // --- Effort (implementation cost; higher = more work) ---
  let effort = f.risk === "high" ? 80 : f.risk === "medium" ? 55 : 25;
  effort += Math.min(20, Math.max(0, f.targetFiles.length - 1) * 8);
  effort = clamp(effort);

  // --- Composite priority ---
  // Entity gaps blend impact with demand + competitive gap; everything else (and
  // gaps with no demand data) rides on impact alone so they're never penalized
  // for lacking a demand signal. Effort discounts; confidence gently weights.
  const upside =
    isGap && f.demand
      ? 0.5 * impact + 0.3 * demand + 0.2 * competitiveGap
      : impact;
  const effortFactor = 1 - (effort / 100) * 0.35; // effort 0→1.0, 100→0.65
  const confidenceFactor = 0.7 + 0.3 * f.confidence; // conf 0→0.70, 1→1.0
  const priority = clamp(upside * effortFactor * confidenceFactor);

  return { impact, demand, competitiveGap, effort, confidence: f.confidence, priority };
}
