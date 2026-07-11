import type { RunStatus } from "@growth/shared/types";

/**
 * Shared run-status classification. The audit pipeline's SUCCESS terminal is
 * `awaiting_dispatch` (it stops there and waits for the user to implement a
 * fix) — NOT `completed`, which only the later develop→PR→validate flow reaches.
 */

// A run has produced a usable audit once it reaches awaiting_dispatch or any
// later implement-flow state. Used by the per-user run cap so audit-only runs
// (which never reach "completed") still count.
const SUCCESSFUL: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "awaiting_dispatch",
  "modifying",
  "awaiting_preview",
  "validating",
  "completed",
]);

export function isSuccessfulAudit(status: RunStatus): boolean {
  return SUCCESSFUL.has(status);
}

// Terminal states — nothing is running, so there's nothing to cancel.
const TERMINAL: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "awaiting_dispatch",
  "completed",
  "failed",
  "cancelled",
]);

export function isCancellable(status: RunStatus): boolean {
  return !TERMINAL.has(status);
}
