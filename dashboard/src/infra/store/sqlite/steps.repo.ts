import type { AgentStep, AgentName, AgentStepStatus } from "@growth/shared/types";
import type { StepsRepoPort } from "@/core/ports/store.port";
import { getDb } from "./client";

interface Row {
  id: string;
  run_id: string;
  agent: string;
  parent_step_id: string | null;
  title: string;
  status: string;
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  input_json: string | null;
  output_json: string | null;
  error_json: string | null;
  metadata_json: string | null;
}

function toStep(row: Row): AgentStep {
  return {
    id: row.id,
    runId: row.run_id,
    agent: row.agent as AgentName,
    parentStepId: row.parent_step_id,
    title: row.title,
    status: row.status as AgentStepStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    input: row.input_json ? JSON.parse(row.input_json) : null,
    output: row.output_json ? JSON.parse(row.output_json) : null,
    error: row.error_json ? JSON.parse(row.error_json) : null,
    metadata: row.metadata_json
      ? (JSON.parse(row.metadata_json) as Record<string, unknown>)
      : {},
  };
}

export const stepsRepo: StepsRepoPort = {
  insert(step) {
    getDb()
      .prepare(
        `INSERT INTO agent_steps (id, run_id, agent, parent_step_id, title, status,
          started_at, ended_at, duration_ms, input_json, output_json, error_json, metadata_json)
        VALUES (@id, @runId, @agent, @parentStepId, @title, @status,
          @startedAt, @endedAt, @durationMs, @input, @output, @error, @metadata)`,
      )
      .run({
        id: step.id,
        runId: step.runId,
        agent: step.agent,
        parentStepId: step.parentStepId,
        title: step.title,
        status: step.status,
        startedAt: step.startedAt,
        endedAt: step.endedAt,
        durationMs: step.durationMs,
        input: step.input ? JSON.stringify(step.input) : null,
        output: step.output ? JSON.stringify(step.output) : null,
        error: step.error ? JSON.stringify(step.error) : null,
        metadata: JSON.stringify(step.metadata),
      });
  },
  update(stepId, patch) {
    const row = getDb()
      .prepare("SELECT * FROM agent_steps WHERE id = ?")
      .get(stepId) as Row | undefined;
    if (!row) return;
    const current = toStep(row);
    const merged: AgentStep = { ...current, ...patch };
    if (merged.endedAt && !merged.durationMs)
      merged.durationMs = merged.endedAt - merged.startedAt;
    getDb()
      .prepare(
        `UPDATE agent_steps SET status = @status, ended_at = @endedAt, duration_ms = @durationMs,
          input_json = @input, output_json = @output, error_json = @error, metadata_json = @metadata
         WHERE id = @id`,
      )
      .run({
        id: merged.id,
        status: merged.status,
        endedAt: merged.endedAt,
        durationMs: merged.durationMs,
        input: merged.input ? JSON.stringify(merged.input) : null,
        output: merged.output ? JSON.stringify(merged.output) : null,
        error: merged.error ? JSON.stringify(merged.error) : null,
        metadata: JSON.stringify(merged.metadata ?? {}),
      });
  },
  byRun(runId) {
    const rows = getDb()
      .prepare(
        "SELECT * FROM agent_steps WHERE run_id = ? ORDER BY started_at ASC",
      )
      .all(runId) as Row[];
    return rows.map(toStep);
  },
};
