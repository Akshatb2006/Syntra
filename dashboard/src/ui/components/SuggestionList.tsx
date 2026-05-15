"use client";
import type { Suggestion } from "@growth/shared/types";
import { Badge } from "./Badge";
import { Button } from "./Button";

const IMPACT_TONE: Record<
  Suggestion["expectedImpact"],
  "muted" | "warn" | "success"
> = {
  low: "muted",
  medium: "warn",
  high: "success",
};

interface Props {
  suggestions: Suggestion[];
  onDevelop?: (suggestion: Suggestion) => void;
}

export function SuggestionList({ suggestions, onDevelop }: Props) {
  if (suggestions.length === 0) {
    return (
      <div className="text-sm text-[var(--fg-muted)]">
        No suggestions yet — the orchestrator is still planning.
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {suggestions.map((s, i) => (
        <li
          key={s.id}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-sm"
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 font-medium text-[var(--fg)]">
              <span className="mr-2 text-[var(--fg-muted)]">#{i + 1}</span>
              {s.title}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={IMPACT_TONE[s.expectedImpact]}>
                impact: {s.expectedImpact}
              </Badge>
              <Badge tone="muted">priority: {Math.round(s.priorityScore)}</Badge>
              <StatusBadge status={s.status} />
            </div>
          </div>
          <div className="text-xs text-[var(--fg-muted)]">{s.description}</div>
          {s.geoContext && (
            <div className="mt-1 text-xs text-teal-300">
              geo: {s.geoContext.locality}
            </div>
          )}
          {onDevelop && isActionable(s) && (
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--fg-muted)]">
                {s.status === "failed"
                  ? "Last dispatch failed — try again with a clarifying prompt."
                  : "Ready to develop on a testing branch."}
              </span>
              <Button onClick={() => onDevelop(s)} variant="primary">
                Develop
              </Button>
            </div>
          )}
          {s.status === "implemented" && (
            <div className="mt-2 text-xs text-emerald-300">
              Implemented · PR #{s.prNumber ?? "?"} opened on
              <span className="ml-1 font-mono">
                {s.dispatchJobId?.slice(0, 8) ?? "—"}
              </span>
            </div>
          )}
          {s.status === "dispatched" && (
            <div className="mt-2 text-xs text-amber-300 pulse-soft">
              Claude Code is implementing — this can take a few minutes.
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function isActionable(s: Suggestion): boolean {
  return (
    s.status === "proposed" ||
    s.status === "selected" ||
    s.status === "failed" ||
    s.status === "rejected"
  );
}

function StatusBadge({ status }: { status: Suggestion["status"] }) {
  const tone =
    status === "implemented" || status === "validated"
      ? "success"
      : status === "failed" || status === "rejected"
        ? "danger"
        : status === "dispatched"
          ? "warn"
          : "muted";
  return <Badge tone={tone}>{status}</Badge>;
}
