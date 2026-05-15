import type { TracerPort, SpanHandle, SpanOptions } from "@/core/ports/tracer.port";
import type { TraceSpan } from "@growth/shared/types";

/**
 * Tees span events to multiple tracers (e.g. SQLite + Console + Omium).
 * Uses the first tracer's traceId/spanId so all backends agree.
 */
class CompositeSpan implements SpanHandle {
  constructor(private handles: SpanHandle[]) {}
  get traceId() {
    return this.handles[0]!.traceId;
  }
  get spanId() {
    return this.handles[0]!.spanId;
  }
  get runId() {
    return this.handles[0]!.runId;
  }
  setAttribute(k: string, v: unknown): void {
    for (const h of this.handles) h.setAttribute(k, v);
  }
  addEvent(name: string, attributes?: Record<string, unknown>): void {
    for (const h of this.handles) h.addEvent(name, attributes);
  }
  end(opts?: { status?: TraceSpan["status"]; error?: Error; attributes?: Record<string, unknown> }) {
    for (const h of this.handles) h.end(opts);
  }
}

export class CompositeTracer implements TracerPort {
  constructor(private tracers: TracerPort[]) {}
  startSpan(opts: SpanOptions): SpanHandle {
    const primary = this.tracers[0]!.startSpan(opts);
    const enrichedOpts: SpanOptions = {
      ...opts,
      attributes: { ...(opts.attributes ?? {}), traceId: primary.traceId },
    };
    const rest = this.tracers
      .slice(1)
      .map((t) => t.startSpan({ ...enrichedOpts, parentSpanId: opts.parentSpanId }));
    return new CompositeSpan([primary, ...rest]);
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
  async flush(): Promise<void> {
    await Promise.all(this.tracers.map((t) => t.flush?.()));
  }
}
