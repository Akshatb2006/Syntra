"use client";
import type { Suggestion, SuggestionCategory, SuggestionEvidence } from "@growth/shared/types";

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
  performance: 2,
  image_optimization: 2,
  content_quality: 3,
};

const EVIDENCE_SOURCE_LABEL: Record<SuggestionEvidence["source"], string> = {
  crawl: "CRAWL",
  lighthouse: "LIGHTHOUSE",
  geo: "GEO",
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

export function SuggestionList({ suggestions, onDevelop }: Props) {
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

  const renderGroup = (title: string, items: Suggestion[], accent?: string, success?: boolean) => {
    if (items.length === 0) return null;
    return (
      <div className="sug-group" key={title}>
        <div className="sug-group-head">
          <span className={`name ${accent || ''}`}>{title}</span>
          <span className="count">{items.length}</span>
          <span className="rule"></span>
        </div>
        {items.map((s, i) => (
          <div
            key={s.id}
            className={`sug-card ${s.status === 'dispatched' ? 'live' : s.status === 'failed' || s.status === 'rejected' ? 'dim' : ''}`}
          >
            <div className="sug-row">
              <div>
                <div className="sug-title-row">
                  <span className="sug-title">{s.title}</span>
                  <span className="sug-cat">{s.category ?? 'general'}</span>
                  <ConfidencePill confidence={s.confidence} />
                </div>
                {s.issue && (
                  <div className="sug-issue">
                    <span className="label-sm">Issue</span>
                    <span className="sug-issue-text">{s.issue}</span>
                  </div>
                )}
                <EvidenceBlock evidence={s.evidence} />
                {s.implementation && (
                  <div className="sug-impl">
                    <span className="label-sm">Implementation</span>
                    <span className="sug-impl-text">{s.implementation}</span>
                  </div>
                )}
                {s.geoContext && (
                  <div style={{ fontSize: 11, color: 'var(--accent-strong)', marginTop: 4 }}>
                    geo: {s.geoContext.locality}
                  </div>
                )}
                <div className="sug-meta">
                  <div className="pair">
                    <span className="label-sm">Impact</span>
                    <span className={`pill ${IMPACT_PILL[s.expectedImpact]}`}>{IMPACT_LABEL[s.expectedImpact]}</span>
                  </div>
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
                    <button className="btn btn-secondary">Skip</button>
                  </>
                ) : (
                  <SugStatusPill status={s.status} />
                )}
              </div>
            </div>
          </div>
        ))}
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
