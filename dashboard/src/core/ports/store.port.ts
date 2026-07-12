import type {
  AgentStep,
  Run,
  Suggestion,
  TraceSpan,
  RunStatus,
} from "@growth/shared/types";
import type { Credentials } from "@growth/shared/schemas";

/** Alpha access gate: new users start `pending`; an admin flips them to
 *  `approved` (or `rejected`). Only `approved` (or admins) can run audits. */
export type AccessStatus = "pending" | "approved" | "rejected";

/** The customer-discovery info a user submits when requesting alpha access. */
export interface AccessRequest {
  company: string;
  website: string;
  industry: string;
  teamSize: string;
  useCase: string;
}

/** An authenticated user (created on first Google sign-in). */
export interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
  company: string | null;
  website: string | null;
  role: string | null;
  onboarded: boolean;
  // --- Alpha access gating ---
  accessStatus: AccessStatus;
  industry: string | null;
  teamSize: string | null;
  useCase: string | null;
  requestedAt: number | null;
  accessUpdatedAt: number | null;
  createdAt: number;
}

export interface UsersRepoPort {
  /** Find by Google email, creating the user on first sign-in. Returns the user. */
  upsertByEmail(input: { email: string; name: string; image: string | null }): User;
  get(id: string): User | undefined;
  getByEmail(email: string): User | undefined;
  /** Save onboarding answers and flip `onboarded` to true. */
  setOnboarding(id: string, fields: { company: string; website?: string | null; role: string }): void;
  /** Record an alpha-access request (stores the form + stamps requestedAt).
   *  Status stays `pending` until an admin acts. */
  setAccessRequest(id: string, fields: AccessRequest): void;
  /** Admin action: approve/reject a user. */
  setAccessStatus(id: string, status: AccessStatus): void;
  /** All users who have submitted a request, newest first (admin view). */
  listAccessRequests(): User[];
}

export interface RunsRepoPort {
  insert(run: Run): void;
  get(runId: string): Run | undefined;
  /** When `owner` is given, returns only that user's runs (per-user isolation). */
  list(limit?: number, owner?: string): Run[];
  patchStatus(runId: string, status: RunStatus): void;
  patch(runId: string, fields: Partial<Run>): void;
  /**
   * Attach a repo + credentials to an existing audit-only run when the user
   * decides to implement a fix. Updates the input's repoUrl and the
   * credentials_ref column.
   */
  attachRepo(
    runId: string,
    fields: { repoUrl?: string; credentialsRef?: string },
  ): void;
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

export interface GeoCacheRepoPort {
  get<T>(
    key: string,
    maxAgeMs?: number,
  ): { value: T; createdAt: number } | null;
  set<T>(key: string, city: string, value: T): void;
}

export interface StorePort {
  runs: RunsRepoPort;
  users: UsersRepoPort;
  steps: StepsRepoPort;
  traces: TracesRepoPort;
  suggestions: SuggestionsRepoPort;
  secrets: SecretsRepoPort;
  geoCache: GeoCacheRepoPort;
}
