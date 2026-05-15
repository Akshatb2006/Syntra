"use client";
import type { Suggestion } from "@growth/shared/types";

interface Props {
  suggestions: Suggestion[];
  onDevelop?: (suggestion: Suggestion) => void;
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
                </div>
                <div className="sug-desc">{s.description}</div>
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
                    <button className="btn btn-primary" onClick={() => onDevelop(s)}>Develop</button>
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
      {renderGroup("Proposed", proposed)}
      {renderGroup("In flight", inFlight, "accent")}
      {renderGroup("Implemented", done, "success")}
      {renderGroup("Failed / Rejected", failed)}
    </div>
  );
}
