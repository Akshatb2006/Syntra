import { randomBytes } from "node:crypto";
import type { Request } from "express";
import { TRACE_HEADER } from "@growth/shared/types";
import type { TraceContext } from "@growth/shared/types";

export function newTraceId(): string {
  return randomBytes(16).toString("hex");
}

export function newSpanId(): string {
  return randomBytes(8).toString("hex");
}

export function extractTraceContext(req: Request): TraceContext {
  const traceId =
    (req.headers[TRACE_HEADER.TRACE_ID] as string | undefined)?.trim() ||
    newTraceId();
  const parentSpanIdHeader = req.headers[TRACE_HEADER.PARENT_SPAN_ID];
  const parentSpanId =
    (typeof parentSpanIdHeader === "string" && parentSpanIdHeader.trim()) ||
    null;
  return { traceId, parentSpanId };
}

export function injectTraceContext(
  headers: Record<string, string>,
  ctx: TraceContext,
): Record<string, string> {
  headers[TRACE_HEADER.TRACE_ID] = ctx.traceId;
  if (ctx.parentSpanId) headers[TRACE_HEADER.PARENT_SPAN_ID] = ctx.parentSpanId;
  return headers;
}
