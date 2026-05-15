import { Badge } from "./Badge";
import type { RunStatus, AgentStepStatus } from "@growth/shared/types";

const RUN_TONE: Record<RunStatus, Parameters<typeof Badge>[0]["tone"]> = {
  queued: "muted",
  crawling: "accent",
  researching: "accent",
  planning: "accent",
  awaiting_dispatch: "warn",
  modifying: "warn",
  awaiting_preview: "warn",
  validating: "accent",
  completed: "success",
  failed: "danger",
  cancelled: "muted",
};

const STEP_TONE: Record<AgentStepStatus, Parameters<typeof Badge>[0]["tone"]> = {
  pending: "muted",
  running: "accent",
  completed: "success",
  failed: "danger",
  skipped: "muted",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge tone={RUN_TONE[status]}>{status.replace(/_/g, " ")}</Badge>;
}

export function StepStatusBadge({ status }: { status: AgentStepStatus }) {
  return <Badge tone={STEP_TONE[status]}>{status}</Badge>;
}
