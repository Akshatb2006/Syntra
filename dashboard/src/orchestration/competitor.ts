import type { DemandSignal, Finding, SuggestionEvidence } from "@growth/shared/types";
import type { CompetitorIntelOutput, CompetitorGap } from "@/agents/competitor-intel.agent";

/**
 * Fold competitor intelligence into the findings. Two effects:
 *
 *   1. BOOST — a content-gap entity the site already mentions that competitors
 *      also own a page for becomes more urgent (validated demand AND proven
 *      buildability). We raise its score and add the competitor proof.
 *   2. INJECT — a topic competitors own that the site doesn't cover at all is a
 *      net-new gap the mention-based detector could never find ("Redfin owns a
 *      'coming soon homes' page, you don't"). We synthesize a content-gap finding
 *      for it, carrying a competitor-derived demand signal so it ranks + renders
 *      like any other gap.
 *
 * Deterministic + honest: a competitor topic the site DOES cover (per the crawl)
 * with no matching gap is dropped, not surfaced as a false deficit. The agent
 * observed the competitors; the gap/boost policy lives here.
 */

export interface SiteCoverage {
  /** Lowercased topics/entities/path-segments the crawl shows the site covers. */
  tokens: Set<string>;
}

export function applyCompetitorIntel(
  findings: Finding[],
  intel: CompetitorIntelOutput,
  coverage: SiteCoverage,
  detectedAt = Date.now(),
): Finding[] {
  const gaps = intel.gaps ?? [];
  if (gaps.length === 0) return findings;

  // Index existing content-gap findings by lowercased entity for boost matching.
  const byEntity = new Map<string, number>();
  findings.forEach((f, i) => {
    if (f.category === "content_gap" && f.entityName) {
      byEntity.set(f.entityName.toLowerCase(), i);
    }
  });

  const boosts = new Map<number, { ownedBy: string[]; evidence: string[] }>();
  const newFindings: Finding[] = [];

  for (const g of gaps) {
    const topic = g.topic.toLowerCase().trim();
    if (!topic) continue;

    const matchIdx = matchExisting(topic, byEntity);
    if (matchIdx !== undefined) {
      const prev = boosts.get(matchIdx) ?? { ownedBy: [], evidence: [] };
      prev.ownedBy.push(...g.ownedBy);
      prev.evidence.push(...g.evidence);
      boosts.set(matchIdx, prev);
      continue;
    }
    // No matching finding. If the crawl shows the site already covers it, there's
    // no deficit — skip (never invent a gap the site has already filled).
    if (coverageHas(coverage.tokens, topic)) continue;
    newFindings.push(buildCompetitorFinding(g, detectedAt));
  }

  const boosted = findings.map((f, i) => {
    const b = boosts.get(i);
    return b ? boostFinding(f, b.ownedBy, b.evidence, detectedAt) : f;
  });

  // Competitor data changed scores + added findings — restore strongest-first.
  return [...boosted, ...newFindings].sort((a, b) => b.baseScore - a.baseScore);
}

/** Match a competitor topic to an existing gap entity (exact, then substring). */
function matchExisting(topic: string, byEntity: Map<string, number>): number | undefined {
  const exact = byEntity.get(topic);
  if (exact !== undefined) return exact;
  for (const [name, idx] of byEntity) {
    if (name.length >= 4 && (topic.includes(name) || name.includes(topic))) return idx;
  }
  return undefined;
}

function coverageHas(tokens: Set<string>, topic: string): boolean {
  if (tokens.has(topic)) return true;
  for (const t of tokens) {
    if (t.length >= 4 && (topic.includes(t) || t.includes(topic))) return true;
  }
  return false;
}

/** Raise a known gap's score and attach competitor proof, merging owners. */
function boostFinding(
  f: Finding,
  ownedBy: string[],
  evidenceLines: string[],
  detectedAt: number,
): Finding {
  const prior = f.demand?.competitorsOwning ?? [];
  const merged = dedupe([...prior, ...ownedBy.map(norm)]);
  const newOwners = merged.length - prior.length;
  const count = merged.length;

  const demand: DemandSignal = f.demand
    ? { ...f.demand, competitorsOwning: merged }
    : {
        entity: f.entityName ?? "",
        score: 60,
        band: "medium",
        intent: "commercial",
        competitorsOwning: merged,
        evidence: [],
        observed: true,
      };

  const ev: SuggestionEvidence[] = [];
  // Only add the headline line when competitor research surfaced owners demand
  // validation hadn't already listed — otherwise it duplicates the demand line.
  if (newOwners > 0 || prior.length === 0) {
    ev.push({
      source: "competitor",
      detail: `${count} competitor${count === 1 ? "" : "s"} own a dedicated "${f.entityName}" page: ${merged.join(", ")}`,
      detectedAt,
    });
  }
  for (const line of dedupe(evidenceLines).slice(0, 2)) {
    ev.push({ source: "competitor", detail: line, detectedAt });
  }

  // A gap competitors have already built is lower-risk and higher-urgency.
  const baseScore = Math.min(92, f.baseScore + Math.min(10, count * 3));
  return { ...f, baseScore, demand, evidence: [...f.evidence, ...ev] };
}

/** Synthesize a content-gap finding for a topic competitors own but the site lacks. */
function buildCompetitorFinding(g: CompetitorGap, detectedAt: number): Finding {
  const ownedBy = dedupe(g.ownedBy.map(norm));
  const count = ownedBy.length;
  // Competitor density is the demand proxy here — the more competitors own a
  // dedicated page, the stronger the signal that the topic is worth building.
  const score = Math.min(88, 60 + count * 8);
  const demand: DemandSignal = {
    entity: g.topic,
    score,
    band: score >= 70 ? "high" : "medium",
    intent: "commercial",
    competitorsOwning: ownedBy,
    evidence: g.evidence.slice(0, 3),
    observed: true,
  };

  const evidence: SuggestionEvidence[] = [
    {
      source: "competitor",
      detail: `${count} competitor${count === 1 ? "" : "s"} own a dedicated "${g.topic}" page (${ownedBy.join(", ")}) — your site doesn't cover this topic`,
      detectedAt,
    },
  ];
  for (const line of g.evidence.slice(0, 2)) {
    evidence.push({ source: "competitor", detail: line, detectedAt });
  }

  return {
    category: "content_gap",
    issue: `No page for "${g.topic}" — ${count} competitor${count === 1 ? "" : "s"} own one`,
    evidence,
    // Inferred from competitors, not measured on the target's own HTML — so it
    // sits below direct crawl facts. More competitor owners → more certain.
    confidence: Math.round(Math.min(0.8, 0.6 + count * 0.06) * 100) / 100,
    expectedImpact: count >= 2 ? "high" : "medium",
    risk: "medium",
    baseScore: Math.min(86, 58 + count * 6),
    suggestedTitle: `Create a "${g.topic}" page — competitors own it, you don't`,
    suggestedImplementation: `Build a dedicated page targeting "${g.topic}". Competitors (${ownedBy.join(", ")}) rank with dedicated pages for it while your site has none — capture that demand with focused, schema-rich content and internal links, and register it in the sitemap.`,
    targetFiles: [`src/app/${slugify(g.topic)}/page.tsx`, "src/app/sitemap.ts"],
    entityKind: "competitor",
    entityName: g.topic,
    demand,
  };
}

function norm(d: string): string {
  return d.trim().toLowerCase().replace(/^www\./, "").replace(/\/.*$/, "");
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
