export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  input_json TEXT NOT NULL,
  status TEXT NOT NULL,
  credentials_ref TEXT NOT NULL DEFAULT '',
  workspace_id TEXT NOT NULL,
  pr_url TEXT,
  preview_url TEXT,
  baseline_lh_json TEXT,
  after_lh_json TEXT,
  error_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);

CREATE TABLE IF NOT EXISTS agent_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  parent_step_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER,
  input_json TEXT,
  output_json TEXT,
  error_json TEXT,
  metadata_json TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_steps_run ON agent_steps(run_id, started_at);

CREATE TABLE IF NOT EXISTS trace_spans (
  span_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_span_id TEXT,
  run_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  attributes_json TEXT NOT NULL,
  events_json TEXT NOT NULL,
  error_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_traces_trace ON trace_spans(trace_id, start_time);
CREATE INDEX IF NOT EXISTS idx_traces_run ON trace_spans(run_id, start_time);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT NOT NULL,
  expected_impact TEXT NOT NULL,
  risk TEXT NOT NULL,
  priority_score REAL NOT NULL,
  target_files_json TEXT NOT NULL,
  geo_context_json TEXT,
  status TEXT NOT NULL,
  dispatch_job_id TEXT,
  pr_number INTEGER,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_suggestions_run ON suggestions(run_id, priority_score DESC);

CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
