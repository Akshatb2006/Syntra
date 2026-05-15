import type { PlatformEventType } from "../types/event.js";

export const EVENT_TYPES: Record<string, PlatformEventType> = {
  RUN_CREATED: "run.created",
  RUN_STATUS_CHANGED: "run.status_changed",
  RUN_COMPLETED: "run.completed",
  RUN_FAILED: "run.failed",
  AGENT_STEP_STARTED: "agent.step_started",
  AGENT_STEP_PROGRESS: "agent.step_progress",
  AGENT_STEP_FINISHED: "agent.step_finished",
  TRACE_SPAN_STARTED: "trace.span_started",
  TRACE_SPAN_FINISHED: "trace.span_finished",
  SUGGESTION_PROPOSED: "suggestion.proposed",
  SUGGESTION_SELECTED: "suggestion.selected",
  DISPATCH_STARTED: "dispatch.started",
  DISPATCH_COMPLETED: "dispatch.completed",
  WEBHOOK_RECEIVED: "webhook.received",
  PREVIEW_READY: "preview.ready",
  LOG: "log",
};
