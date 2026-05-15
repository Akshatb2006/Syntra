import type { AgentStep } from "@growth/shared/types";
import { AGENTS } from "@growth/shared/constants";
import { StepStatusBadge } from "./StatusBadge";

function relative(start: number, end: number | null): string {
  const d = (end ?? Date.now()) - start;
  if (d < 1000) return `${d}ms`;
  if (d < 60_000) return `${(d / 1000).toFixed(1)}s`;
  return `${(d / 60_000).toFixed(1)}m`;
}

export function Timeline({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) {
    return (
      <div className="text-sm text-[var(--fg-muted)]">No agent activity yet.</div>
    );
  }
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li
          key={step.id}
          className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3"
        >
          <div
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              step.status === "running"
                ? "bg-teal-300 pulse-soft"
                : step.status === "completed"
                  ? "bg-emerald-400"
                  : step.status === "failed"
                    ? "bg-rose-400"
                    : "bg-zinc-500"
            }`}
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-[var(--fg)]">
                <span className="font-medium">
                  {AGENTS[step.agent]?.displayName ?? step.agent}
                </span>
                <span className="text-[var(--fg-muted)]"> · {step.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--fg-muted)]">
                  {relative(step.startedAt, step.endedAt)}
                </span>
                <StepStatusBadge status={step.status} />
              </div>
            </div>
            {step.error && (
              <div className="text-xs text-rose-400">{step.error.message}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
