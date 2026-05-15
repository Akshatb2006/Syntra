export type RunStatus =
  | "queued"
  | "crawling"
  | "researching"
  | "planning"
  | "awaiting_dispatch"
  | "modifying"
  | "awaiting_preview"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunInput {
  siteUrl: string;
  repoUrl: string;
  branchBase?: string;
  /**
   * Primary city the site serves. Used by the Geo Intelligence agent to seed
   * locality discovery. If omitted, agents fall back to detection from the
   * crawl content.
   */
  city?: string;
  trigger: RunTrigger;
}

export type RunTrigger =
  | { kind: "manual"; userId: string }
  | { kind: "github_webhook"; deliveryId: string; commit: string }
  | { kind: "vercel_webhook"; deploymentId: string }
  | { kind: "scheduled"; cron: string };

export interface Run {
  id: string;
  input: RunInput;
  status: RunStatus;
  /**
   * Opaque pointer to encrypted credentials in the secrets table. Persisted
   * with the run so user-triggered dispatches (after planning) can look up
   * the GitHub token without re-asking the user.
   */
  credentialsRef: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  workspaceId: string;
  prUrl: string | null;
  previewUrl: string | null;
  baselineLighthouse: LighthouseSummary | null;
  afterLighthouse: LighthouseSummary | null;
  error: { message: string; stack?: string } | null;
}

export interface LighthouseSummary {
  url: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fetchedAt: number;
}

export interface RunDelta {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}
