import type { TracerPort, SpanHandle, SpanOptions } from "@/core/ports/tracer.port";
import type { TraceSpan } from "@growth/shared/types";
import { newSpanId, newTraceId } from "@/lib/id";
import { tracesRepo } from "@/infra/store/sqlite/traces.repo";

class SqliteSpan implements SpanHandle {
  private span: TraceSpan;
  private ended = false;
  constructor(span: TraceSpan) {
    this.span = span;
    tracesRepo.upsertStart(this.span);
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
    tracesRepo.upsertStart(this.span);
  }
  addEvent(name: string, attributes?: Record<string, unknown>): void {
    this.span.events.push({ ts: Date.now(), name, attributes });
    tracesRepo.upsertStart(this.span);
  }
  end(opts?: { status?: TraceSpan["status"]; error?: Error; attributes?: Record<string, unknown> }) {
    if (this.ended) return;
    this.ended = true;
    this.span.endTime = Date.now();
    this.span.durationMs = this.span.endTime - this.span.startTime;
    this.span.status = opts?.status ?? (opts?.error ? "error" : "ok");
    if (opts?.error)
      this.span.error = { message: opts.error.message, stack: opts.error.stack };
    if (opts?.attributes)
      Object.assign(this.span.attributes, opts.attributes);
    tracesRepo.upsertStart(this.span);
  }
}

export class SqliteTracer implements TracerPort {
  startSpan(opts: SpanOptions): SpanHandle {
    const span: TraceSpan = {
      traceId: opts.attributes?.["traceId"] as string | undefined ?? newTraceId(),
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
    return new SqliteSpan(span);
  }
  async withSpan<T>(opts: SpanOptions, fn: (s: SpanHandle) => Promise<T>): Promise<T> {
    const s = this.startSpan(opts);
    try {
      const r = await fn(s);
      s.end({ status: "ok" });
      return r;
    } catch (err) {
      s.end({ status: "error", error: err instanceof Error ? err : new Error(String(err)) });
      throw err;
    }
  }
}
