/**
 * Demand validation — the axis that turns "entity mentioned + no dedicated page"
 * into "entity mentioned + no page + people actually search for it". Without it,
 * a regulatory mention like "Texas Real Estate Commission" and a commercial
 * platform like "Bayut" look identical (both: mentioned, no page). With it, Bayut
 * scores high (commercial intent, competitors own pages) and the compliance body
 * scores low (informational, nobody is shopping for it) — so the report ranks the
 * buildable, revenue-bearing gaps first.
 *
 * Like geo intelligence, demand is OBSERVED, never fabricated: the agent records
 * what web search actually returned (competitor pages that rank, SERP presence)
 * and the model's intent judgement. We have no paid keyword-volume feed, so we
 * NEVER invent a "search volume" number — `score` is a derived strength signal,
 * not a monthly-volume claim.
 */

/** Coarse demand strength for display + scoring. */
export type DemandBand = "high" | "medium" | "low" | "unknown";

/**
 * What kind of search interest the entity attracts. This is the single biggest
 * differentiator between a buildable gap and a dead one:
 *   - "commercial"    → people search it with buying/comparison intent (a brand,
 *                       platform, integration someone would adopt) → high value.
 *   - "navigational"  → searched, but to reach a specific known site → medium.
 *   - "informational" → researched, not transacted → lower commercial value.
 *   - "regulatory"    → a law/body/compliance term mentioned for completeness; no
 *                       acquisition demand → lowest value (TREC, E-Verify).
 */
export type DemandIntent =
  | "commercial"
  | "navigational"
  | "informational"
  | "regulatory"
  | "unknown";

/**
 * The demand verdict for one entity the site mentions but doesn't own a page for.
 * Attached to its content-gap Finding/Suggestion so the report can rank by — and
 * show — whether the gap is worth building.
 */
export interface DemandSignal {
  entity: string;
  /**
   * 0..100 derived demand strength. Combines observed SERP presence with the
   * model's intent judgement. NOT a search-volume figure — we have no volume
   * feed; this is a relative "is this worth building" signal.
   */
  score: number;
  band: DemandBand;
  intent: DemandIntent;
  /**
   * Competitor domains observed to own a dedicated page/section for this entity.
   * This is the seed of competitor-gap analysis ("3 competitors have a Bayut page,
   * you don't") — captured here because it comes from the same SERP observation.
   */
  competitorsOwning: string[];
  /**
   * Observed evidence lines (competitor pages seen, SERP result presence). Empty
   * when no web search ran (model-only intent judgement) — mirrors the geo agent's
   * "never fabricate demand figures" rule.
   */
  evidence: string[];
  /** Whether a web search actually ran (true) or this is a model-only judgement (false). */
  observed: boolean;
}
