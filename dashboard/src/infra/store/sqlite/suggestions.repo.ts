import type { Suggestion, SuggestionCategory } from "@growth/shared/types";
import type { SuggestionsRepoPort } from "@/core/ports/store.port";
import { getDb } from "./client";

interface Row {
  id: string;
  run_id: string;
  category: string;
  title: string;
  description: string;
  rationale: string;
  expected_impact: string;
  risk: string;
  priority_score: number;
  target_files_json: string;
  geo_context_json: string | null;
  status: string;
  dispatch_job_id: string | null;
  pr_number: number | null;
}

function toSuggestion(row: Row): Suggestion {
  return {
    id: row.id,
    runId: row.run_id,
    category: row.category as SuggestionCategory,
    title: row.title,
    description: row.description,
    rationale: row.rationale,
    expectedImpact: row.expected_impact as Suggestion["expectedImpact"],
    risk: row.risk as Suggestion["risk"],
    priorityScore: row.priority_score,
    targetFiles: JSON.parse(row.target_files_json) as string[],
    geoContext: row.geo_context_json
      ? (JSON.parse(row.geo_context_json) as Suggestion["geoContext"])
      : undefined,
    status: row.status as Suggestion["status"],
    dispatchJobId: row.dispatch_job_id,
    prNumber: row.pr_number,
  };
}

export const suggestionsRepo: SuggestionsRepoPort = {
  insertMany(suggestions) {
    const stmt = getDb().prepare(
      `INSERT OR REPLACE INTO suggestions (
        id, run_id, category, title, description, rationale, expected_impact, risk,
        priority_score, target_files_json, geo_context_json, status, dispatch_job_id, pr_number
      ) VALUES (
        @id, @runId, @category, @title, @description, @rationale, @expectedImpact, @risk,
        @priorityScore, @targetFiles, @geoContext, @status, @dispatchJobId, @prNumber
      )`,
    );
    const tx = getDb().transaction((items: Suggestion[]) => {
      for (const s of items) {
        stmt.run({
          id: s.id,
          runId: s.runId,
          category: s.category,
          title: s.title,
          description: s.description,
          rationale: s.rationale,
          expectedImpact: s.expectedImpact,
          risk: s.risk,
          priorityScore: s.priorityScore,
          targetFiles: JSON.stringify(s.targetFiles),
          geoContext: s.geoContext ? JSON.stringify(s.geoContext) : null,
          status: s.status,
          dispatchJobId: s.dispatchJobId,
          prNumber: s.prNumber,
        });
      }
    });
    tx(suggestions);
  },
  byRun(runId) {
    const rows = getDb()
      .prepare(
        "SELECT * FROM suggestions WHERE run_id = ? ORDER BY priority_score DESC",
      )
      .all(runId) as Row[];
    return rows.map(toSuggestion);
  },
  update(id, patch) {
    const row = getDb()
      .prepare("SELECT * FROM suggestions WHERE id = ?")
      .get(id) as Row | undefined;
    if (!row) return;
    const merged = { ...toSuggestion(row), ...patch };
    this.insertMany([merged]);
  },
};
