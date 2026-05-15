import type { TraceContext } from "@growth/shared/types";
import { newTraceId } from "@/lib/id";

export function newTraceContextForRun(runId: string): TraceContext {
  // One trace per run; child spans created under it.
  return { traceId: newTraceId(), parentSpanId: null };
}

export function childContext(ctx: TraceContext, spanId: string): TraceContext {
  return { traceId: ctx.traceId, parentSpanId: spanId };
}
