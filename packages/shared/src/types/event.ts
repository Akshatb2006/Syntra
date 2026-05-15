/**
 * Events streamed over SSE from MCP server to dashboard and from dashboard
 * to its UI clients. Everything live in the UI flows through this envelope.
 */

import type { AgentStepStatus, AgentName } from "./agent.js";
import type { TraceSpan } from "./trace.js";
import type { RunStatus } from "./run.js";
import type { Suggestion } from "./suggestion.js";
import type { DispatchJobStatus } from "./dispatch.js";

export type PlatformEvent =
  | { type: "run.created"; runId: string; at: number }
  | { type: "run.status_changed"; runId: string; status: RunStatus; at: number }
  | { type: "run.completed"; runId: string; prUrl: string | null; at: number }
  | { type: "run.failed"; runId: string; error: string; at: number }
  | { type: "agent.step_started"; runId: string; agent: AgentName; stepId: string; title: string; at: number }
  | { type: "agent.step_progress"; runId: string; stepId: string; message: string; at: number }
  | { type: "agent.step_finished"; runId: string; stepId: string; status: AgentStepStatus; at: number }
  | { type: "trace.span_started"; runId: string | null; span: Pick<TraceSpan, "traceId" | "spanId" | "parentSpanId" | "kind" | "name" | "startTime"> }
  | { type: "trace.span_finished"; runId: string | null; spanId: string; status: TraceSpan["status"]; endTime: number }
  | { type: "suggestion.proposed"; runId: string; suggestion: Suggestion }
  | { type: "suggestion.selected"; runId: string; suggestionId: string }
  | { type: "dispatch.started"; runId: string; jobId: string; suggestionId: string; at: number }
  | { type: "dispatch.completed"; runId: string; jobStatus: DispatchJobStatus }
  | { type: "webhook.received"; source: "github" | "vercel"; eventType: string; runId: string | null; at: number }
  | { type: "preview.ready"; runId: string; previewUrl: string; at: number }
  | { type: "log"; runId: string | null; level: "info" | "warn" | "error"; message: string; at: number };

export type PlatformEventType = PlatformEvent["type"];
