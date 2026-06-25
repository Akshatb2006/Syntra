import type {
  Suggestion,
  SuggestionCategory,
  SuggestionEvidence,
} from "@growth/shared/types";
import type { SuggestionsRepoPort } from "@/core/ports/store.port";
import { getDb } from "./client";

interface Row {
  id: string;
  run_id: string;
  category: string;
  title: string;
  issue: string | null;
  evidence_json: string | null;
  confidence: number | null;
  description: string;
  rationale: string;
  why_it_matters: string | null;
  business_impact: string | null;
  implementation: string | null;
  expected_impact: string;
  risk: string;
  priority_score: number;
  target_files_json: string;
  geo_context_json: string | null;
  demand_json: string | null;
  opportunity_json: string | null;
  blueprint_json: string | null;
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
    issue: row.issue ?? "",
    evidence: row.evidence_json
      ? (JSON.parse(row.evidence_json) as SuggestionEvidence[])
      : [],
    confidence: row.confidence ?? 1,
    description: row.description,
    rationale: row.rationale,
    whyItMatters: row.why_it_matters ?? undefined,
    businessImpact: row.business_impact ?? undefined,
    implementation: row.implementation ?? "",
    expectedImpact: row.expected_impact as Suggestion["expectedImpact"],
    risk: row.risk as Suggestion["risk"],
    priorityScore: row.priority_score,
    targetFiles: JSON.parse(row.target_files_json) as string[],
    geoContext: row.geo_context_json
      ? (JSON.parse(row.geo_context_json) as Suggestion["geoContext"])
      : undefined,
    demand: row.demand_json
      ? (JSON.parse(row.demand_json) as Suggestion["demand"])
      : undefined,
    opportunity: row.opportunity_json
      ? (JSON.parse(row.opportunity_json) as Suggestion["opportunity"])
      : undefined,
    blueprint: row.blueprint_json
      ? (JSON.parse(row.blueprint_json) as Suggestion["blueprint"])
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
        id, run_id, category, title, issue, evidence_json, confidence, description, rationale,
        why_it_matters, business_impact, implementation, expected_impact, risk,
        priority_score, target_files_json, geo_context_json, demand_json, opportunity_json, blueprint_json, status, dispatch_job_id, pr_number
      ) VALUES (
        @id, @runId, @category, @title, @issue, @evidence, @confidence, @description, @rationale,
        @whyItMatters, @businessImpact, @implementation, @expectedImpact, @risk,
        @priorityScore, @targetFiles, @geoContext, @demand, @opportunity, @blueprint, @status, @dispatchJobId, @prNumber
      )`,
    );
    const tx = getDb().transaction((items: Suggestion[]) => {
      for (const s of items) {
        stmt.run({
          id: s.id,
          runId: s.runId,
          category: s.category,
          title: s.title,
          issue: s.issue ?? "",
          evidence: JSON.stringify(s.evidence ?? []),
          confidence: typeof s.confidence === "number" ? s.confidence : 1,
          description: s.description,
          rationale: s.rationale,
          whyItMatters: s.whyItMatters ?? null,
          businessImpact: s.businessImpact ?? null,
          implementation: s.implementation ?? "",
          expectedImpact: s.expectedImpact,
          risk: s.risk,
          priorityScore: s.priorityScore,
          targetFiles: JSON.stringify(s.targetFiles),
          geoContext: s.geoContext ? JSON.stringify(s.geoContext) : null,
          demand: s.demand ? JSON.stringify(s.demand) : null,
          opportunity: s.opportunity ? JSON.stringify(s.opportunity) : null,
          blueprint: s.blueprint ? JSON.stringify(s.blueprint) : null,
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
