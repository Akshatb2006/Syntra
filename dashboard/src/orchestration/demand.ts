import type { Finding, SuggestionEvidence } from "@growth/shared/types";
import type { DemandIntelOutput } from "@/agents/demand-intel.agent";

/**
 * Fold observed demand into the deterministic findings. The content-gap detector
 * scores a gap purely on coverage magnitude (mentions × pages) — so a regulator
 * mentioned on every page ("Texas Real Estate Commission") and a commercial
 * platform ("Bayut") can score alike. Demand validation breaks that tie: it
 * modulates each gap's baseScore by how worth-building it is, attaches the demand
 * signal for display, and adds the OBSERVED competitor/SERP lines as evidence.
 *
 * Pure + deterministic — the agent does the observing; the scoring policy lives
 * here, in one place, like the rest of the detector. Findings without an
 * entity-demand match pass through untouched.
 */

/**
 * Map a 0..100 demand score to a baseScore multiplier in [0.55, 1.15]. A dead
 * gap (regulatory, no search interest → score ~15) gets ×0.64 and sinks; a
 * strong commercial gap (score ~90) gets ×1.09 and rises. The ceiling stays near
 * 1.0 so demand re-ranks gaps without letting one balloon past structural caps.
 */
function demandMultiplier(score: number): number {
  return 0.55 + (Math.max(0, Math.min(100, score)) / 100) * 0.6;
}

export function applyDemand(findings: Finding[], demand: DemandIntelOutput): Finding[] {
  const byEntity = demand.byEntity ?? {};
  if (Object.keys(byEntity).length === 0) return findings;

  const adjusted = findings.map((f) => {
    if (f.category !== "content_gap" || !f.entityName) return f;
    const signal = byEntity[f.entityName];
    if (!signal) return f;

    // Re-score by demand. baseScore is a 0..100 seed; demand re-weights it.
    const baseScore = Math.max(0, Math.min(100, Math.round(f.baseScore * demandMultiplier(signal.score))));

    // Attach the strongest observed demand lines as first-class evidence so the
    // provenance trail shows WHY the gap rose or sank. Competitor ownership is
    // the most persuasive signal, so it leads.
    const demandEvidence: SuggestionEvidence[] = [];
    const when = f.evidence[0]?.detectedAt;
    if (signal.competitorsOwning.length > 0) {
      demandEvidence.push({
        source: "demand",
        detail: `${signal.competitorsOwning.length} competitor${signal.competitorsOwning.length === 1 ? "" : "s"} rank with a dedicated "${f.entityName}" page: ${signal.competitorsOwning.join(", ")}`,
        detectedAt: when,
      });
    }
    for (const line of signal.evidence.slice(0, 2)) {
      demandEvidence.push({ source: "demand", detail: line, detectedAt: when });
    }
    if (demandEvidence.length === 0) {
      // Even a model-only judgement is worth showing — it explains the re-rank.
      demandEvidence.push({
        source: "demand",
        detail: `Search demand judged ${signal.band} (${signal.intent} intent), score ${signal.score}/100${signal.observed ? "" : " — model judgement, no SERP data"}`,
        detectedAt: when,
      });
    }

    return {
      ...f,
      baseScore,
      demand: signal,
      evidence: [...f.evidence, ...demandEvidence],
    };
  });

  // Demand changed scores — restore the strongest-first invariant the detector
  // guarantees so the orchestrator still sees the best gaps first.
  return adjusted.sort((a, b) => b.baseScore - a.baseScore);
}
