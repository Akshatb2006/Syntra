import type { Run, AgentStep } from "@growth/shared/types";

const RUNNING_STATUSES = new Set([
  "crawling", "researching", "planning", "awaiting_dispatch",
  "modifying", "awaiting_preview", "validating", "queued",
]);

function statusClass(status: string): string {
  if (status === "completed") return "run-status run-status-completed";
  if (status === "failed" || status === "cancelled") return "run-status run-status-failed";
  if (RUNNING_STATUSES.has(status)) return "run-status run-status-running";
  return "run-status run-status-pending";
}

function isRunning(status: string): boolean {
  return RUNNING_STATUSES.has(status);
}

export function RunStatusBadge({ status }: { status: Run["status"] }) {
  const running = isRunning(status);
  return (
    <span className={statusClass(status)}>
      {running && (
        <span
          className="pulse-soft"
          style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', marginRight: 4 }}
        />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function StepStatusBadge({ status }: { status: AgentStep["status"] }) {
  return <span className={statusClass(status)}>{status}</span>;
}
