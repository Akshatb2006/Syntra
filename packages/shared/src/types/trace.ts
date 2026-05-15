export type TraceSpanKind =
  | "agent"
  | "tool_call"
  | "llm_call"
  | "mcp_request"
  | "webhook"
  | "async_dispatch"
  | "validation"
  | "internal";

export type TraceSpanStatus = "ok" | "error" | "cancelled";

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  runId: string | null;
  kind: TraceSpanKind;
  name: string;
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  status: TraceSpanStatus;
  attributes: Record<string, unknown>;
  events: TraceEventEntry[];
  error: { message: string; stack?: string } | null;
}

export interface TraceEventEntry {
  ts: number;
  name: string;
  attributes?: Record<string, unknown>;
}

export interface TraceContext {
  traceId: string;
  parentSpanId: string | null;
}

export const TRACE_HEADER = {
  TRACE_ID: "x-trace-id",
  PARENT_SPAN_ID: "x-parent-span-id",
} as const;
