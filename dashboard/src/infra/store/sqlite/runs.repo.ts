import type { Run, RunStatus } from "@growth/shared/types";
import type { RunsRepoPort } from "@/core/ports/store.port";
import { getDb } from "./client";

interface Row {
  id: string;
  input_json: string;
  status: string;
  credentials_ref: string;
  workspace_id: string;
  pr_url: string | null;
  preview_url: string | null;
  baseline_lh_json: string | null;
  after_lh_json: string | null;
  error_json: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

function toRun(row: Row): Run {
  return {
    id: row.id,
    input: JSON.parse(row.input_json) as Run["input"],
    status: row.status as RunStatus,
    credentialsRef: row.credentials_ref ?? "",
    workspaceId: row.workspace_id,
    prUrl: row.pr_url,
    previewUrl: row.preview_url,
    baselineLighthouse: row.baseline_lh_json
      ? (JSON.parse(row.baseline_lh_json) as Run["baselineLighthouse"])
      : null,
    afterLighthouse: row.after_lh_json
      ? (JSON.parse(row.after_lh_json) as Run["afterLighthouse"])
      : null,
    error: row.error_json
      ? (JSON.parse(row.error_json) as Run["error"])
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export const runsRepo: RunsRepoPort = {
  insert(run) {
    getDb()
      .prepare(
        `INSERT INTO runs (id, input_json, status, credentials_ref, workspace_id, pr_url, preview_url,
          baseline_lh_json, after_lh_json, error_json, created_at, updated_at, completed_at)
        VALUES (@id, @input, @status, @credentialsRef, @workspaceId, @prUrl, @previewUrl,
          @baseline, @after, @error, @createdAt, @updatedAt, @completedAt)`,
      )
      .run({
        id: run.id,
        input: JSON.stringify(run.input),
        status: run.status,
        credentialsRef: run.credentialsRef,
        workspaceId: run.workspaceId,
        prUrl: run.prUrl,
        previewUrl: run.previewUrl,
        baseline: run.baselineLighthouse
          ? JSON.stringify(run.baselineLighthouse)
          : null,
        after: run.afterLighthouse ? JSON.stringify(run.afterLighthouse) : null,
        error: run.error ? JSON.stringify(run.error) : null,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
      });
  },
  get(runId) {
    const row = getDb()
      .prepare("SELECT * FROM runs WHERE id = ?")
      .get(runId) as Row | undefined;
    return row ? toRun(row) : undefined;
  },
  list(limit = 50) {
    const rows = getDb()
      .prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Row[];
    return rows.map(toRun);
  },
  patchStatus(runId, status) {
    getDb()
      .prepare(
        "UPDATE runs SET status = ?, updated_at = ? WHERE id = ?",
      )
      .run(status, Date.now(), runId);
  },
  patch(runId, fields) {
    const cur = this.get(runId);
    if (!cur) return;
    const merged: Run = { ...cur, ...fields, updatedAt: Date.now() };
    getDb()
      .prepare(
        `UPDATE runs SET
          status = @status,
          credentials_ref = @credentialsRef,
          workspace_id = @workspaceId,
          pr_url = @prUrl,
          preview_url = @previewUrl,
          baseline_lh_json = @baseline,
          after_lh_json = @after,
          error_json = @error,
          updated_at = @updatedAt,
          completed_at = @completedAt
        WHERE id = @id`,
      )
      .run({
        id: merged.id,
        status: merged.status,
        credentialsRef: merged.credentialsRef,
        workspaceId: merged.workspaceId,
        prUrl: merged.prUrl,
        previewUrl: merged.previewUrl,
        baseline: merged.baselineLighthouse
          ? JSON.stringify(merged.baselineLighthouse)
          : null,
        after: merged.afterLighthouse
          ? JSON.stringify(merged.afterLighthouse)
          : null,
        error: merged.error ? JSON.stringify(merged.error) : null,
        updatedAt: merged.updatedAt,
        completedAt: merged.completedAt,
      });
  },
  attachRepo(runId, fields) {
    const cur = this.get(runId);
    if (!cur) return;
    const input = {
      ...cur.input,
      ...(fields.repoUrl ? { repoUrl: fields.repoUrl } : {}),
    };
    getDb()
      .prepare(
        `UPDATE runs SET input_json = @input, credentials_ref = @credentialsRef, updated_at = @updatedAt WHERE id = @id`,
      )
      .run({
        id: runId,
        input: JSON.stringify(input),
        credentialsRef: fields.credentialsRef ?? cur.credentialsRef,
        updatedAt: Date.now(),
      });
  },
};
