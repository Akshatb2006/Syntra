"use client";
import { useState } from "react";
import type {
  OpportunityScore,
  Suggestion,
  SuggestionCategory,
  SuggestionEvidence,
} from "@growth/shared/types";

interface Props {
  suggestions: Suggestion[];
  onDevelop?: (suggestion: Suggestion) => void;
}

/**
 * Visual weight of each finding category. Tier 1 = structural/correctness
 * deficits that are objectively measurable (schema, canonical, OG, sitemap,
 * accessibility, locality coverage) — these dominate the screen. Tier 2 =
 * performance. Tier 3 = pure optimization. This is the "hierarchy of findings":
 * not all deficits deserve equal prominence.
 */
const TIER: Record<SuggestionCategory, 1 | 2 | 3> = {
  metadata: 1,
  schema: 1,
  structured_data: 1,
  sitemap_robots: 1,
  internal_linking: 1,
  accessibility: 1,
  locality_page: 1,
  content_gap: 1,
  performance: 2,
  image_optimization: 2,
  content_quality: 3,
};

const EVIDENCE_SOURCE_LABEL: Record<SuggestionEvidence["source"], string> = {
  crawl: "CRAWL",
  lighthouse: "LIGHTHOUSE",
  geo: "GEO",
  demand: "DEMAND",
  competitor: "COMPETITOR",
};

function pagePath(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

function shortDate(ts?: number): string | null {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

/** Confidence band → label + pill class. Direct observations land "certain". */
function confidenceBand(c: number): { label: string; cls: string } {
  if (c >= 0.95) return { label: "certain", cls: "high" };
  if (c >= 0.8) return { label: "likely", cls: "med" };
  return { label: "inferred", cls: "low" };
}

/** Demand band → pill class. Mirrors the impact/confidence pill vocabulary. */
const DEMAND_PILL: Record<NonNullable<Suggestion["demand"]>["band"], string> = {
  high: "high",
  medium: "med",
  low: "low",
  unknown: "low",
};

/**
 * Demand validation pill — the "does anyone search for this?" axis. Shown on
 * content-gap cards so a commercial gap (Bayut, high) visually outranks a
 * regulatory mention (TREC, low). Absent on non-gap suggestions.
 */
function DemandPill({ demand }: { demand: NonNullable<Suggestion["demand"]> }) {
  const comp = demand.competitorsOwning.length;
  const title =
    `Search demand: ${demand.band} (${demand.intent} intent), score ${demand.score}/100. ` +
    (comp > 0
      ? `${comp} competitor${comp === 1 ? "" : "s"} already own a "${demand.entity}" page. `
      : "") +
    (demand.observed ? "Observed via web search." : "Model judgement — no SERP data.") +
    " Not a search-volume figure.";
  return (
    <span className={`pill ${DEMAND_PILL[demand.band]}`} title={title}>
      demand {demand.score}{comp > 0 ? ` · ${comp} comp.` : ""}
    </span>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  if (typeof confidence !== "number") return null;
  const pct = Math.round(confidence * 100);
  const band = confidenceBand(confidence);
  return (
    <span
      className={`pill ${band.cls}`}
      title={`Confidence ${pct}% — ${band.label}. Derived from how the deficit was observed, not its impact.`}
    >
      {pct}% {band.label}
    </span>
  );
}

function EvidenceBlock({ evidence }: { evidence: SuggestionEvidence[] }) {
  if (!evidence || evidence.length === 0) return null;
  return (
    <div className="sug-evidence">
      <span className="label-sm">Evidence · {evidence.length} signal{evidence.length === 1 ? "" : "s"}</span>
      <ul className="sug-evidence-list">
        {evidence.map((e, i) => {
          const page = pagePath(e.url);
          const when = shortDate(e.detectedAt);
          return (
            <li key={i}>
              <span className={`ev-src ev-${e.source}`}>
                {EVIDENCE_SOURCE_LABEL[e.source]}
              </span>
              <span className="ev-body">
                <span className="ev-detail">{e.detail}</span>
                {(page || when) && (
                  <span className="ev-prov">
                    {page && <span className="ev-page">{page}</span>}
                    {when && <span className="ev-when">· {when}</span>}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Business Insight — the layer that makes a finding feel like Syntra understood
 * the business, not just the HTML. Added by the Enrichment agent; absent on
 * legacy suggestions, in which case nothing renders.
 */
function BusinessInsight({ s }: { s: Suggestion }) {
  if (!s.whyItMatters && !s.businessImpact) return null;
  return (
    <div className="sug-insight">
      <span className="label-sm sug-insight-label">Why it matters</span>
      {s.whyItMatters && <p className="sug-insight-why">{s.whyItMatters}</p>}
      {s.businessImpact && (
        <p className="sug-insight-impact">
          <span className="sug-insight-impact-tag">Business impact</span>
          {s.businessImpact}
        </p>
      )}
    </div>
  );
}

/**
 * Opportunity breakdown — the "prioritization system" view. Shows WHY a
 * suggestion ranks where it does: business value, validated demand, the
 * competitive gap, build cost, and evidence strength, all feeding one priority.
 * Absent on legacy suggestions (renders nothing).
 */
function OppMetric({
  label,
  value,
  hint,
  invert,
}: {
  label: string;
  value: number;
  hint: string;
  invert?: boolean;
}) {
  // invert = "lower is better" (effort): green when low, amber otherwise.
  const strong = invert ? value <= 35 : value >= 70;
  const cls = strong ? "" : "med";
  return (
    <div className="opp-metric" title={hint}>
      <span className="label-sm opp-label">{label}</span>
      <div className="bar">
        <div className={`fill ${cls}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="num">{Math.round(value)}</span>
    </div>
  );
}

function OpportunityBreakdown({ opp, isGap }: { opp: OpportunityScore; isGap: boolean }) {
  return (
    <div className="sug-opportunity">
      <span className="label-sm">Opportunity · priority {Math.round(opp.priority)}</span>
      <div className="opp-grid">
        <OppMetric label="Impact" value={opp.impact} hint="Business value / revenue potential" />
        {isGap && (
          <OppMetric label="Demand" value={opp.demand} hint="Validated search demand for this entity" />
        )}
        {isGap && opp.competitiveGap > 0 && (
          <OppMetric
            label="Competitive gap"
            value={opp.competitiveGap}
            hint="How much competitors own this that you don't"
          />
        )}
        <OppMetric label="Effort" value={opp.effort} hint="Implementation cost (lower is better)" invert />
        <OppMetric
          label="Confidence"
          value={Math.round(opp.confidence * 100)}
          hint="Evidence strength — how sure we are the deficit is real"
        />
      </div>
    </div>
  );
}

/** Effort glance pill for the meta row. Low effort = good = green. */
function EffortPill({ effort }: { effort: number }) {
  const label = effort <= 35 ? "LOW" : effort <= 60 ? "MED" : "HIGH";
  const cls = effort <= 35 ? "high" : effort <= 60 ? "med" : "low";
  return (
    <span className={`pill ${cls}`} title={`Implementation effort ${Math.round(effort)}/100 — lower is better`}>
      {label}
    </span>
  );
}

/**
 * Page Blueprint — the executable layer. Turns "create an X page" into a concrete
 * outline (title / sections / keywords) a writer or the code agent can build from.
 * Only present on buildable content-gap suggestions.
 */
function PageBlueprint({ bp }: { bp: NonNullable<Suggestion["blueprint"]> }) {
  return (
    <div className="sug-blueprint">
      <span className="label-sm sug-blueprint-label">Page blueprint</span>
      <p className="sug-blueprint-title">{bp.title}</p>
      {bp.angle && <p className="sug-blueprint-angle">{bp.angle}</p>}
      {bp.sections.length > 0 && (
        <div className="sug-blueprint-block">
          <span className="label-sm">Sections</span>
          <ol className="sug-blueprint-sections">
            {bp.sections.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      {bp.keywords.length > 0 && (
        <div className="sug-blueprint-block">
          <span className="label-sm">Target keywords</span>
          <span className="sug-blueprint-kw">
            {bp.keywords.map((k) => (
              <code key={k} className="kw">{k}</code>
            ))}
          </span>
        </div>
      )}
      {bp.metaDescription && (
        <div className="sug-blueprint-block">
          <span className="label-sm">Meta description</span>
          <span className="sug-blueprint-meta">{bp.metaDescription}</span>
        </div>
      )}
    </div>
  );
}

const IMPACT_PILL: Record<Suggestion["expectedImpact"], string> = {
  low: "low",
  medium: "med",
  high: "high",
};

const IMPACT_LABEL: Record<Suggestion["expectedImpact"], string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
};

function SugStatusPill({ status }: { status: Suggestion["status"] }) {
  const map: Record<string, string> = {
    implemented: "open",
    validated: "open",
    dispatched: "dispatch pulse-soft",
    failed: "low",
    rejected: "low",
    proposed: "pending",
    selected: "pending",
  };
  const label: Record<string, string> = {
    implemented: "DONE",
    validated: "VALIDATED",
    dispatched: "DISPATCHING",
    failed: "FAILED",
    rejected: "REJECTED",
    proposed: "PROPOSED",
    selected: "SELECTED",
  };
  return <span className={`pill ${map[status] ?? 'low'}`}>{label[status] ?? status}</span>;
}

function isActionable(s: Suggestion): boolean {
  return (
    s.status === "proposed" ||
    s.status === "selected" ||
    s.status === "failed" ||
    s.status === "rejected"
  );
}

function priorityFillClass(score: number): string {
  if (score >= 75) return "";
  if (score >= 45) return "med";
  return "med";
}

/** One-line teaser shown while collapsed so the list still reads at a glance. */
function teaser(s: Suggestion): string {
  const t = s.issue || s.whyItMatters || s.description || "";
  return t.length > 150 ? `${t.slice(0, 149)}…` : t;
}

export function SuggestionList({ suggestions, onDevelop }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (suggestions.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
        No suggestions yet — the orchestrator is still planning.
      </div>
    );
  }

  const proposed = suggestions.filter(s => s.status === 'proposed' || s.status === 'selected');
  // Hierarchy of findings: structural/correctness deficits (schema, canonical,
  // OG, sitemap, accessibility, locality) carry the most weight and dominate the
  // screen; performance is second; pure optimization is last. Within a tier we
  // sort by priority so the strongest measured deficit leads.
  const byPriority = (a: Suggestion, b: Suggestion) => b.priorityScore - a.priorityScore;
  const tier1 = proposed.filter(s => TIER[s.category] === 1).sort(byPriority);
  const tier2 = proposed.filter(s => TIER[s.category] === 2).sort(byPriority);
  const tier3 = proposed.filter(s => (TIER[s.category] ?? 3) === 3).sort(byPriority);
  const inFlight = suggestions.filter(s => s.status === 'dispatched');
  const done = suggestions.filter(s => s.status === 'implemented' || s.status === 'validated');
  const failed = suggestions.filter(s => s.status === 'failed' || s.status === 'rejected');

  const renderGroup = (title: string, items: Suggestion[], accent?: string) => {
    if (items.length === 0) return null;
    return (
      <div className="sug-group" key={title}>
        <div className="sug-group-head">
          <span className={`name ${accent || ''}`}>{title}</span>
          <span className="count">{items.length}</span>
          <span className="rule"></span>
        </div>
        {items.map((s) => {
          const isOpen = expanded.has(s.id);
          return (
            <div
              key={s.id}
              className={`sug-card ${isOpen ? 'open' : ''} ${s.status === 'dispatched' ? 'live' : s.status === 'failed' || s.status === 'rejected' ? 'dim' : ''}`}
            >
              <div className="sug-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Clickable headline — toggles the detail view. */}
                  <button
                    type="button"
                    className="sug-head-btn"
                    aria-expanded={isOpen}
                    onClick={() => toggle(s.id)}
                  >
                    <span className={`sug-chevron ${isOpen ? 'open' : ''}`} aria-hidden>▸</span>
                    <span className="sug-head-main">
                      <span className="sug-title-row">
                        <span className="sug-title">{s.title}</span>
                        <span className="sug-cat">{s.category ?? 'general'}</span>
                        {s.demand && <DemandPill demand={s.demand} />}
                        <ConfidencePill confidence={s.confidence} />
                      </span>
                      {!isOpen && teaser(s) && (
                        <span className="sug-teaser">{teaser(s)}</span>
                      )}
                    </span>
                  </button>

                  {/* Detail view — revealed on click. */}
                  {isOpen && (
                    <div className="sug-detail">
                      {s.issue && (
                        <div className="sug-issue">
                          <span className="label-sm">Issue</span>
                          <span className="sug-issue-text">{s.issue}</span>
                        </div>
                      )}
                      <BusinessInsight s={s} />
                      {s.opportunity && (
                        <OpportunityBreakdown
                          opp={s.opportunity}
                          isGap={s.category === "content_gap" || s.category === "locality_page"}
                        />
                      )}
                      {s.demand && s.demand.competitorsOwning.length > 0 && (
                        <div className="sug-issue">
                          <span className="label-sm">Competitor gap</span>
                          <span className="sug-issue-text">
                            {s.demand.competitorsOwning.length} competitor
                            {s.demand.competitorsOwning.length === 1 ? "" : "s"} rank with a
                            dedicated “{s.demand.entity}” page ({s.demand.competitorsOwning.join(", ")})
                            {" "}— you don’t.
                          </span>
                        </div>
                      )}
                      <EvidenceBlock evidence={s.evidence} />
                      {s.implementation && (
                        <div className="sug-impl">
                          <span className="label-sm">What this changes</span>
                          <span className="sug-impl-text">{s.implementation}</span>
                        </div>
                      )}
                      {s.blueprint && <PageBlueprint bp={s.blueprint} />}
                      {s.targetFiles && s.targetFiles.length > 0 && (
                        <div className="sug-targets">
                          <span className="label-sm">Target files</span>
                          <span className="sug-targets-list">
                            {s.targetFiles.map((f) => (
                              <code key={f} className="sug-target">{f}</code>
                            ))}
                          </span>
                        </div>
                      )}
                      {s.geoContext && (
                        <div style={{ fontSize: 11, color: 'var(--accent-strong)', marginTop: 4 }}>
                          geo: {s.geoContext.locality}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="sug-meta">
                    <div className="pair">
                      <span className="label-sm">Impact</span>
                      <span className={`pill ${IMPACT_PILL[s.expectedImpact]}`}>{IMPACT_LABEL[s.expectedImpact]}</span>
                    </div>
                    {s.opportunity && (
                      <div className="pair">
                        <span className="label-sm">Effort</span>
                        <EffortPill effort={s.opportunity.effort} />
                      </div>
                    )}
                    <div className="sug-priority">
                      <span className="label-sm">Priority</span>
                      <div className="bar">
                        <div className={`fill ${priorityFillClass(s.priorityScore)}`} style={{ width: `${Math.min(100, s.priorityScore)}%` }}></div>
                      </div>
                      <span className="num">{Math.round(s.priorityScore)}</span>
                    </div>
                  </div>
                  {s.status === 'dispatched' && (
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 8 }}>
                      {s.dispatchJobId ? `job ${s.dispatchJobId.slice(0, 8)} · dispatching…` : 'Claude Code is implementing — this can take a few minutes.'}
                    </div>
                  )}
                  {s.status === 'implemented' && s.prNumber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 11.5, color: 'var(--fg-muted)' }}>
                      <span>PR #{s.prNumber} opened</span>
                      <span style={{ color: 'var(--success)' }}>✓ implemented</span>
                    </div>
                  )}
                  {s.status === 'failed' && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>
                      Last dispatch failed — try again with a clarifying prompt.
                    </div>
                  )}
                </div>
                <div className="sug-actions">
                  {isActionable(s) && onDevelop ? (
                    <>
                      <button className="btn btn-primary" onClick={() => onDevelop(s)}>Generate PR</button>
                      <button className="btn btn-secondary" onClick={() => toggle(s.id)}>
                        {isOpen ? 'Less' : 'Details'}
                      </button>
                    </>
                  ) : (
                    <SugStatusPill status={s.status} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {renderGroup("Structural issues", tier1)}
      {renderGroup("Performance", tier2)}
      {renderGroup("Optimization", tier3)}
      {renderGroup("In flight", inFlight, "accent")}
      {renderGroup("Implemented", done, "success")}
      {renderGroup("Failed / Rejected", failed)}
    </div>
  );
}
