import type { TraceSpan, TraceSpanKind } from "@growth/shared/types";
import type { TracesRepoPort } from "@/core/ports/store.port";
import { getDb } from "./client";

interface Row {
  span_id: string;
  trace_id: string;
  parent_span_id: string | null;
  run_id: string | null;
  kind: string;
  name: string;
  start_time: number;
  end_time: number | null;
  duration_ms: number | null;
  status: string;
  attributes_json: string;
  events_json: string;
  error_json: string | null;
}

function toSpan(row: Row): TraceSpan {
  return {
    spanId: row.span_id,
    traceId: row.trace_id,
    parentSpanId: row.parent_span_id,
    runId: row.run_id,
    kind: row.kind as TraceSpanKind,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMs: row.duration_ms,
    status: row.status as TraceSpan["status"],
    attributes: JSON.parse(row.attributes_json) as Record<string, unknown>,
    events: JSON.parse(row.events_json) as TraceSpan["events"],
    error: row.error_json ? (JSON.parse(row.error_json) as TraceSpan["error"]) : null,
  };
}

export const tracesRepo: TracesRepoPort = {
  upsertStart(span) {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO trace_spans (
          span_id, trace_id, parent_span_id, run_id, kind, name,
          start_time, end_time, duration_ms, status, attributes_json, events_json, error_json
        ) VALUES (
          @spanId, @traceId, @parentSpanId, @runId, @kind, @name,
          @startTime, @endTime, @durationMs, @status, @attributes, @events, @error
        )`,
      )
      .run({
        spanId: span.spanId,
        traceId: span.traceId,
        parentSpanId: span.parentSpanId,
        runId: span.runId,
        kind: span.kind,
        name: span.name,
        startTime: span.startTime,
        endTime: span.endTime,
        durationMs: span.durationMs,
        status: span.status,
        attributes: JSON.stringify(span.attributes),
        events: JSON.stringify(span.events),
        error: span.error ? JSON.stringify(span.error) : null,
      });
  },
  upsertEnd(spanId, patch) {
    const row = getDb()
      .prepare("SELECT * FROM trace_spans WHERE span_id = ?")
      .get(spanId) as Row | undefined;
    if (!row) return;
    const current = toSpan(row);
    const merged: TraceSpan = { ...current, ...patch };
    if (merged.endTime && !merged.durationMs)
      merged.durationMs = merged.endTime - merged.startTime;
    this.upsertStart(merged);
  },
  byRun(runId) {
    const rows = getDb()
      .prepare(
        "SELECT * FROM trace_spans WHERE run_id = ? ORDER BY start_time ASC",
      )
      .all(runId) as Row[];
    return rows.map(toSpan);
  },
  byTrace(traceId) {
    const rows = getDb()
      .prepare(
        "SELECT * FROM trace_spans WHERE trace_id = ? ORDER BY start_time ASC",
      )
      .all(traceId) as Row[];
    return rows.map(toSpan);
  },
};
