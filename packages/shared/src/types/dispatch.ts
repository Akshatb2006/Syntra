/**
 * /dispatch/code-edit — generic Claude Code subprocess endpoint on MCP server.
 * Pattern adapted from reference/apartmenthub-mcp's /dispatch/seo-develop.
 */

import type { Suggestion } from "./suggestion.js";

export interface DispatchCodeEditRequest {
  runId: string;
  workspaceId: string;
  suggestion: Suggestion;
  branchName: string;
  baseBranch?: string;
  githubRepoFullName: string;
  traceContext: {
    traceId: string;
    parentSpanId: string | null;
  };
  priorPrompts?: string[];
  isRefinement?: boolean;
}

export interface DispatchCodeEditResponse {
  jobId: string;
  status: "dispatched";
  logUrl: string;
}

export interface DispatchJobStatus {
  jobId: string;
  runId: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  prNumber: number | null;
  prUrl: string | null;
  branchName: string;
}
