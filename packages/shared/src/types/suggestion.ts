export type SuggestionCategory =
  | "metadata"
  | "schema"
  | "internal_linking"
  | "locality_page"
  | "performance"
  | "image_optimization"
  | "content_quality"
  | "accessibility"
  | "structured_data"
  | "sitemap_robots";

export type SuggestionImpact = "low" | "medium" | "high";
export type SuggestionRisk = "low" | "medium" | "high";

export interface Suggestion {
  id: string;
  runId: string;
  category: SuggestionCategory;
  title: string;
  description: string;
  rationale: string;
  expectedImpact: SuggestionImpact;
  risk: SuggestionRisk;
  priorityScore: number;
  targetFiles: string[];
  geoContext?: GeoSuggestionContext;
  status: SuggestionStatus;
  dispatchJobId: string | null;
  prNumber: number | null;
}

export type SuggestionStatus =
  | "proposed"
  | "selected"
  | "dispatched"
  | "implemented"
  | "validated"
  | "rejected"
  | "failed";

export interface GeoSuggestionContext {
  locality: string;
  city: string;
  landmarks: string[];
  searchIntents: string[];
  keywordCluster: string[];
}
