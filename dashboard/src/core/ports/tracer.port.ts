import type { TraceSpan, TraceSpanKind } from "@growth/shared/types";

export interface SpanOptions {
  name: string;
  kind: TraceSpanKind;
  runId?: string | null;
  parentSpanId?: string | null;
  attributes?: Record<string, unknown>;
}

export interface SpanHandle {
  readonly traceId: string;
  readonly spanId: string;
  readonly runId: string | null;
  setAttribute(key: string, value: unknown): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  end(opts?: {
    status?: TraceSpan["status"];
    error?: Error;
    attributes?: Record<string, unknown>;
  }): void;
}

export interface TracerPort {
  startSpan(opts: SpanOptions): SpanHandle;
  /** Convenience: run an async function inside a span, auto-end on resolve/reject. */
  withSpan<T>(opts: SpanOptions, fn: (span: SpanHandle) => Promise<T>): Promise<T>;
  /** Optional flush — useful before process exit. */
  flush?(): Promise<void>;
}
