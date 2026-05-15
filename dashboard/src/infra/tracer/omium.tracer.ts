import type { TracerPort, SpanHandle, SpanOptions } from "@/core/ports/tracer.port";
import type { TraceSpan } from "@growth/shared/types";
import { newSpanId, newTraceId } from "@/lib/id";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Adapter that ships spans to Omium's hosted ingestion endpoint.
 *
 * Wire format (matches the official Python SDK's `OmiumTracer._send_spans`):
 *
 *   POST  {OMIUM_API_URL}/api/v1/traces/ingest
 *   Header: X-API-Key: {OMIUM_API_KEY}
 *   Body:
 *     {
 *       "project": "<project name>",
 *       "execution_id": "<one execution per Omium run — we use our runId>",
 *       "spans": [<see SDK shape below>],
 *       "sdk_version": "...",
 *       "metadata": { "workflow_id": "...", "trace_id": "..." }
 *     }
 *
 * Spans for a given execution_id are batched together and flushed as a single
 * POST. Different runs/executions get separate POSTs.
 *
 * Omium expects only COMPLETED spans (one record per span on end), not
 * start/end pairs like OpenTelemetry's OTLP. The Python SDK accumulates spans
 * in memory until flush() is called.
 */

const DEFAULT_EXECUTION_ID = "no-run";
const SDK_VERSION = "growth-engineer/0.1.0";
const SERVICE_NAME = "growth-engineer-dashboard";

interface OmiumSpanPayload {
  span_id: string;
  trace_id: string;
  parent_span_id: string | null;
  name: string;
  service_name: string;
  start_time: string; // ISO
  end_time: string | null;
  duration_ms: number | null;
  status: "ok" | "error" | "unset";
  status_message: string | null;
  attributes: Record<string, unknown>;
  events: Array<{ name: string; attributes: Record<string, unknown> | undefined }>;
}

function mapStatus(s: TraceSpan["status"]): OmiumSpanPayload["status"] {
  if (s === "ok") return "ok";
  if (s === "error") return "error";
  return "unset";
}

function toOmium(span: TraceSpan, projectId: string): OmiumSpanPayload {
  return {
    span_id: span.spanId,
    trace_id: span.traceId,
    parent_span_id: span.parentSpanId,
    name: span.name,
    service_name: SERVICE_NAME,
    start_time: new Date(span.startTime).toISOString(),
    end_time: span.endTime ? new Date(span.endTime).toISOString() : null,
    duration_ms: span.durationMs,
    status: mapStatus(span.status),
    status_message: span.error?.message ?? null,
    attributes: {
      ...span.attributes,
      span_type: span.kind,
      workflow_id: projectId,
    },
    events: span.events.map((e) => ({
      name: e.name,
      attributes: e.attributes,
    })),
  };
}

class OmiumTransport {
  private queues = new Map<string, TraceSpan[]>();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly endpoint: string;
  private readonly key: string;
  private readonly project: string;

  constructor(url: string, key: string, projectId: string) {
    // Trim trailing slash, then add /api/v1 if not present (per docs).
    let base = url.replace(/\/$/, "");
    if (!/\/api\/v\d+$/.test(base)) base = `${base}/api/v1`;
    this.endpoint = `${base}/traces/ingest`;
    this.key = key;
    this.project = projectId;
  }

  enqueueCompleted(span: TraceSpan): void {
    const execId = span.runId ?? DEFAULT_EXECUTION_ID;
    const q = this.queues.get(execId) ?? [];
    q.push(span);
    this.queues.set(execId, q);
    const total = Array.from(this.queues.values()).reduce(
      (n, arr) => n + arr.length,
      0,
    );
    if (total >= 25) void this.flush();
    else this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => void this.flush(), 1000);
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queues.size === 0) return;
    const batches = Array.from(this.queues.entries());
    this.queues.clear();
    await Promise.all(batches.map(([execId, spans]) => this.send(execId, spans)));
  }

  private async send(executionId: string, spans: TraceSpan[]): Promise<void> {
    if (spans.length === 0) return;
    const rootTraceId = spans[0]!.traceId;
    const payload = {
      project: this.project,
      execution_id: executionId,
      spans: spans.map((s) => toOmium(s, this.project)),
      sdk_version: SDK_VERSION,
      metadata: {
        workflow_id: this.project,
        trace_id: rootTraceId,
      },
    };
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.key,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res
          .text()
          .then((t) => t.slice(0, 600))
          .catch(() => "(no body)");
        logger.warn("omium_flush_rejected", {
          endpoint: this.endpoint,
          status: res.status,
          statusText: res.statusText,
          executionId,
          batchSize: spans.length,
          body,
        });
        return;
      }
      logger.info("omium_flush_ok", {
        endpoint: this.endpoint,
        status: res.status,
        executionId,
        batchSize: spans.length,
      });
    } catch (err) {
      logger.warn("omium_flush_failed", {
        endpoint: this.endpoint,
        error: err instanceof Error ? err.message : String(err),
        executionId,
        batchSize: spans.length,
      });
    }
  }
}

class OmiumSpan implements SpanHandle {
  private span: TraceSpan;
  private ended = false;
  constructor(
    span: TraceSpan,
    private transport: OmiumTransport,
  ) {
    this.span = span;
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
  }
  end(opts?: {
    status?: TraceSpan["status"];
    error?: Error;
    attributes?: Record<string, unknown>;
  }): void {
    if (this.ended) return;
    this.ended = true;
    this.span.endTime = Date.now();
    this.span.durationMs = this.span.endTime - this.span.startTime;
    this.span.status = opts?.status ?? (opts?.error ? "error" : "ok");
    if (opts?.error)
      this.span.error = { message: opts.error.message, stack: opts.error.stack };
    if (opts?.attributes) Object.assign(this.span.attributes, opts.attributes);
    this.transport.enqueueCompleted({ ...this.span });
  }
}

class NoopSpan implements SpanHandle {
  constructor(private span: TraceSpan) {}
  get traceId() {
    return this.span.traceId;
  }
  get spanId() {
    return this.span.spanId;
  }
  get runId() {
    return this.span.runId;
  }
  setAttribute(): void {}
  addEvent(): void {}
  end(): void {}
}

export class OmiumTracer implements TracerPort {
  private transport: OmiumTransport | null;

  constructor() {
    this.transport =
      env.omiumUrl && env.omiumKey
        ? new OmiumTransport(env.omiumUrl, env.omiumKey, env.omiumProjectId)
        : null;
  }

  isEnabled(): boolean {
    return this.transport !== null;
  }

  startSpan(opts: SpanOptions): SpanHandle {
    const span: TraceSpan = {
      traceId:
        (opts.attributes?.["traceId"] as string | undefined) ?? newTraceId(),
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
    if (!this.transport) return new NoopSpan(span);
    return new OmiumSpan(span, this.transport);
  }

  async withSpan<T>(opts: SpanOptions, fn: (s: SpanHandle) => Promise<T>): Promise<T> {
    const s = this.startSpan(opts);
    try {
      const r = await fn(s);
      s.end({ status: "ok" });
      return r;
    } catch (err) {
      s.end({
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }

  async flush(): Promise<void> {
    await this.transport?.flush();
  }
}
