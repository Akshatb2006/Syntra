import type { TracerPort, SpanHandle, SpanOptions } from "@/core/ports/tracer.port";
import type { TraceSpan } from "@growth/shared/types";
import { newSpanId, newTraceId } from "@/lib/id";
import { logger } from "@/lib/logger";

class ConsoleSpan implements SpanHandle {
  private span: TraceSpan;
  constructor(span: TraceSpan) {
    this.span = span;
    logger.info("span_start", {
      traceId: span.traceId,
      spanId: span.spanId,
      parent: span.parentSpanId,
      kind: span.kind,
      name: span.name,
      runId: span.runId,
    });
  }
  get traceId() {
    return this.span.traceId;
  }
  get spanId() {
    return this.span.spanId;
  }
  get runId() {
    return this.span.runId;
  }
  setAttribute(k: string, v: unknown): void {
    this.span.attributes[k] = v;
  }
  addEvent(name: string, attributes?: Record<string, unknown>): void {
    this.span.events.push({ ts: Date.now(), name, attributes });
    logger.debug("span_event", {
      spanId: this.span.spanId,
      name,
      attributes,
    });
  }
  end(opts?: { status?: TraceSpan["status"]; error?: Error; attributes?: Record<string, unknown> }) {
    this.span.endTime = Date.now();
    this.span.durationMs = this.span.endTime - this.span.startTime;
    this.span.status = opts?.status ?? (opts?.error ? "error" : "ok");
    if (opts?.error)
      this.span.error = { message: opts.error.message, stack: opts.error.stack };
    if (opts?.attributes)
      Object.assign(this.span.attributes, opts.attributes);
    logger.info("span_end", {
      spanId: this.span.spanId,
      durationMs: this.span.durationMs,
      status: this.span.status,
      error: this.span.error?.message,
    });
  }
}

export class ConsoleTracer implements TracerPort {
  startSpan(opts: SpanOptions): SpanHandle {
    const span: TraceSpan = {
      traceId: newTraceId(),
      spanId: newSpanId(),
      parentSpanId: opts.parentSpanId ?? null,
      runId: opts.runId ?? null,
      kind: opts.kind,
      name: opts.name,
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
      status: "ok",
      attributes: { ...(opts.attributes ?? {}) },
      events: [],
      error: null,
    };
    return new ConsoleSpan(span);
  }
  async withSpan<T>(opts: SpanOptions, fn: (s: SpanHandle) => Promise<T>): Promise<T> {
    const span = this.startSpan(opts);
    try {
      const result = await fn(span);
      span.end({ status: "ok" });
      return result;
    } catch (err) {
      span.end({ status: "error", error: err instanceof Error ? err : new Error(String(err)) });
      throw err;
    }
  }
}
