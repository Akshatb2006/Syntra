import type {
  AgentStep,
  Run,
  Suggestion,
  TraceSpan,
  RunStatus,
} from "@growth/shared/types";
import type { Credentials } from "@growth/shared/schemas";

export interface RunsRepoPort {
  insert(run: Run): void;
  get(runId: string): Run | undefined;
  list(limit?: number): Run[];
  patchStatus(runId: string, status: RunStatus): void;
  patch(runId: string, fields: Partial<Run>): void;
}

export interface StepsRepoPort {
  insert(step: AgentStep): void;
  update(stepId: string, patch: Partial<AgentStep>): void;
  byRun(runId: string): AgentStep[];
}

export interface TracesRepoPort {
  upsertStart(span: TraceSpan): void;
  upsertEnd(spanId: string, patch: Partial<TraceSpan>): void;
  byRun(runId: string): TraceSpan[];
  byTrace(traceId: string): TraceSpan[];
}

export interface SuggestionsRepoPort {
  insertMany(suggestions: Suggestion[]): void;
  byRun(runId: string): Suggestion[];
  update(id: string, patch: Partial<Suggestion>): void;
}

export interface SecretsRepoPort {
  upsert(id: string, plaintextJson: Credentials): void;
  get(id: string): Credentials | null;
  delete(id: string): void;
}

export interface StorePort {
  runs: RunsRepoPort;
  steps: StepsRepoPort;
  traces: TracesRepoPort;
  suggestions: SuggestionsRepoPort;
  secrets: SecretsRepoPort;
}
