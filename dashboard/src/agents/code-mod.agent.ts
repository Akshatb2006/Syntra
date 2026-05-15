import { BaseAgent, type AgentContext } from "./base";
import { AGENTS } from "@growth/shared/constants";
import type { Suggestion } from "@growth/shared/types";
import type { McpClientPort } from "@/core/ports/mcp.port";

export interface CodeModSingleInput {
  workspaceId: string;
  repoFullName: string;
  baseBranch: string;
  githubToken: string;
  suggestion: Suggestion;
  /** Optional human-provided refinement instruction to pass to Claude Code. */
  userPrompt?: string;
}

export interface CodeModSingleResult {
  suggestionId: string;
  jobId: string | null;
  status: "succeeded" | "failed";
  prNumber: number | null;
  prUrl: string | null;
  branchName: string;
  error?: string;
}

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

export class CodeModAgent extends BaseAgent<CodeModSingleInput, CodeModSingleResult> {
  readonly name = "code_mod" as const;
  readonly title = AGENTS.code_mod.displayName;
  readonly model = AGENTS.code_mod.model;

  constructor(private mcp: McpClientPort) {
    super();
  }

  /**
   * Dispatch ONE suggestion via Claude Code on the MCP server. Pushes to a
   * `testing/...` branch and opens (or updates) a PR. The agent's run() entry
   * point is per-suggestion now — this agent is user-triggered, not part of
   * the autonomous audit pipeline.
   */
  async run(ctx: AgentContext, input: CodeModSingleInput): Promise<CodeModSingleResult> {
    const { suggestion } = input;
    const span = ctx.tracer.startSpan({
      name: "agent.code_mod",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: {
        repo: input.repoFullName,
        suggestionId: suggestion.id,
        category: suggestion.category,
        hasUserPrompt: Boolean(input.userPrompt?.trim()),
      },
    });
    const step = this.createStep(
      ctx,
      `Dispatch: ${suggestion.title}`,
      {
        repo: input.repoFullName,
        suggestionId: suggestion.id,
        userPromptLength: input.userPrompt?.length ?? 0,
      },
      null,
    );

    const branchName = CodeModAgent.branchFor(suggestion, ctx.runId);

    try {
      const dispatchRes = await this.mcp.dispatchCodeEdit(
        {
          runId: ctx.runId,
          workspaceId: input.workspaceId,
          suggestion,
          branchName,
          baseBranch: input.baseBranch,
          githubRepoFullName: input.repoFullName,
          traceContext: { traceId: span.traceId, parentSpanId: span.spanId },
          priorPrompts: input.userPrompt?.trim() ? [input.userPrompt.trim()] : undefined,
          // Refinement only if the suggestion was previously dispatched at least once.
          isRefinement: suggestion.dispatchJobId !== null,
        },
        input.githubToken,
      );

      ctx.store.suggestions.update(suggestion.id, {
        status: "dispatched",
        dispatchJobId: dispatchRes.jobId,
      });

      // Poll job status until terminal.
      const finalStatus = await this.pollJob(
        dispatchRes.jobId,
        15 * 60 * 1000,
        5000,
      );

      let result: CodeModSingleResult;
      if (finalStatus.status === "succeeded") {
        ctx.store.suggestions.update(suggestion.id, {
          status: "implemented",
          prNumber: finalStatus.prNumber,
        });
        // Record the PR URL on the run so the UI top-bar can surface it.
        if (finalStatus.prUrl) {
          ctx.store.runs.patch(ctx.runId, { prUrl: finalStatus.prUrl });
        }
        result = {
          suggestionId: suggestion.id,
          jobId: dispatchRes.jobId,
          status: "succeeded",
          prNumber: finalStatus.prNumber,
          prUrl: finalStatus.prUrl,
          branchName,
        };
      } else {
        ctx.store.suggestions.update(suggestion.id, { status: "failed" });
        result = {
          suggestionId: suggestion.id,
          jobId: dispatchRes.jobId,
          status: "failed",
          prNumber: null,
          prUrl: null,
          branchName,
          error: `Dispatch ended with status ${finalStatus.status}`,
        };
      }

      this.completeStep(ctx, step, result);
      span.end({
        status: result.status === "succeeded" ? "ok" : "error",
        attributes: { prNumber: result.prNumber, branch: branchName },
      });
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      ctx.store.suggestions.update(suggestion.id, { status: "failed" });
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      return {
        suggestionId: suggestion.id,
        jobId: null,
        status: "failed",
        prNumber: null,
        prUrl: null,
        branchName,
        error: e.message,
      };
    }
  }

  static branchFor(s: Suggestion, runId: string): string {
    const slug = s.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return `testing/${runId.slice(0, 8)}/${s.category}-${slug}`;
  }

  private async pollJob(
    jobId: string,
    timeoutMs: number,
    intervalMs: number,
  ) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.mcp.dispatchJobStatus(jobId).catch(() => null);
      if (status && TERMINAL.has(status.status)) return status;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Dispatch job ${jobId} timed out after ${timeoutMs}ms`);
  }
}
