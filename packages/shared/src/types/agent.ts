export type AgentName =
  | "orchestrator"
  | "crawl_seo"
  | "site_understanding"
  | "geo_intel"
  | "demand_intel"
  | "competitor_intel"
  | "enrichment"
  | "code_mod"
  | "validation";

export type AgentStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface AgentStep {
  id: string;
  runId: string;
  agent: AgentName;
  parentStepId: string | null;
  title: string;
  status: AgentStepStatus;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  input: unknown;
  output: unknown;
  error: { message: string; stack?: string } | null;
  metadata: Record<string, unknown>;
}

export interface AgentResult<T = unknown> {
  stepId: string;
  agent: AgentName;
  output: T;
  metadata?: Record<string, unknown>;
}
