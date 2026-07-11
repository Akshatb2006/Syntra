/**
 * Cooperative run cancellation. The audit pipeline runs in-process; there's no
 * external job we can SIGKILL, so cancellation is cooperative: the cancel API
 * marks a runId here, and the pipeline calls `throwIfCancelled` at each phase
 * boundary and bails out. Cancel therefore takes effect at the next boundary
 * (worst case, one agent's duration), which stops all remaining LLM work.
 *
 * The registry is module-level in-memory state — fine because the pipeline and
 * the API route share the same Node process (single-host deploy).
 */
const requested = new Set<string>();

export function requestCancel(runId: string): void {
  requested.add(runId);
}

export function isCancelRequested(runId: string): boolean {
  return requested.has(runId);
}

/** Clear the flag once a run is fully settled (success, failure, or cancelled). */
export function clearCancel(runId: string): void {
  requested.delete(runId);
}

/** Thrown by `throwIfCancelled` so the pipeline's catch can distinguish a
 *  user cancel from a genuine failure. */
export class RunCancelledError extends Error {
  constructor(public readonly runId: string) {
    super(`Run ${runId} was cancelled`);
    this.name = "RunCancelledError";
  }
}

export function throwIfCancelled(runId: string): void {
  if (requested.has(runId)) throw new RunCancelledError(runId);
}
