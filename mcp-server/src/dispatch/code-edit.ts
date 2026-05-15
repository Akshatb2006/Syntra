import { spawn } from "node:child_process";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { workspaceManager } from "../workspace/manager.js";
import { eventBus } from "../events/bus.js";
import { jobStore } from "./jobs.js";
import { buildCodeEditPrompt } from "./prompt-builder.js";
import { AppError } from "../lib/errors.js";
import type { DispatchCodeEditRequest } from "@growth/shared/types";
import { Octokit } from "@octokit/rest";

interface DispatchInit extends DispatchCodeEditRequest {
  username: string;
  githubToken: string;
}

export function dispatchCodeEdit(input: DispatchInit): {
  jobId: string;
  logFile: string;
} {
  if (!workspaceManager.exists(input.workspaceId)) {
    throw new AppError("WORKSPACE_NOT_FOUND", "Workspace not initialized", {
      workspaceId: input.workspaceId,
    });
  }
  const jobId = jobStore.newJobId();
  const prompt = buildCodeEditPrompt({
    runId: input.runId,
    jobId,
    user: input.username,
    suggestion: input.suggestion,
    repoFullName: input.githubRepoFullName,
    branchName: input.branchName,
    baseBranch: input.baseBranch ?? "main",
    priorPrompts: input.priorPrompts ?? [],
    isRefinement: input.isRefinement ?? false,
  });

  const cwd = workspaceManager.repoPath(input.workspaceId);
  const child = spawn(
    config.claudeBin,
    ["-p", prompt, "--dangerously-skip-permissions"],
    {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GITHUB_TOKEN: input.githubToken,
        GH_TOKEN: input.githubToken,
      },
    },
  );

  const cancel = () => {
    try {
      child.kill("SIGTERM");
    } catch {
      // best-effort
    }
  };

  const job = jobStore.create(
    jobId,
    {
      runId: input.runId,
      branchName: input.branchName,
    },
    cancel,
  );

  job.logStream.write(
    `=== Job ${jobId} started ${new Date().toISOString()} ===\n` +
      `User: ${input.username}\n` +
      `Run: ${input.runId}\n` +
      `Repo: ${input.githubRepoFullName}\n` +
      `Branch: ${input.branchName}\n` +
      `Suggestion: ${input.suggestion.title}\n\n` +
      `--- PROMPT ---\n${prompt}\n\n--- OUTPUT ---\n`,
  );

  eventBus.publish({
    type: "dispatch.started",
    runId: input.runId,
    jobId,
    suggestionId: input.suggestion.id,
    at: Date.now(),
  });
  logger.info("dispatch_started", {
    jobId,
    runId: input.runId,
    suggestion: input.suggestion.title,
  });

  child.stdout?.pipe(job.logStream, { end: false });
  child.stderr?.pipe(job.logStream, { end: false });

  const softTimer = setTimeout(() => {
    logger.warn("dispatch_soft_timeout", { jobId });
    try {
      child.kill("SIGTERM");
    } catch {
      // best-effort
    }
  }, config.dispatchTimeoutMs);

  child.on("exit", async (code) => {
    clearTimeout(softTimer);
    const exitCode = code ?? -1;
    const status = exitCode === 0 ? "succeeded" : "failed";
    let prNumber: number | null = null;
    let prUrl: string | null = null;
    if (status === "succeeded") {
      try {
        const [owner, repo] = input.githubRepoFullName.split("/");
        const octo = new Octokit({ auth: input.githubToken });
        const { data } = await octo.pulls.list({
          owner: owner ?? "",
          repo: repo ?? "",
          state: "open",
          head: `${owner}:${input.branchName}`,
          per_page: 1,
        });
        if (data[0]) {
          prNumber = data[0].number;
          prUrl = data[0].html_url;
          jobStore.update(jobId, { prNumber, prUrl });
        }
      } catch (err) {
        logger.warn("dispatch_pr_lookup_failed", {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const finished = jobStore.finish(jobId, exitCode, status);
    if (finished) {
      eventBus.publish({
        type: "dispatch.completed",
        runId: input.runId,
        jobStatus: jobStore.toStatus(finished),
      });
    }
    logger.info("dispatch_done", { jobId, exitCode, status, prNumber });
  });

  child.on("error", (err) => {
    clearTimeout(softTimer);
    jobStore.finish(jobId, -1, "failed");
    logger.error("dispatch_process_error", { jobId, error: err.message });
  });

  child.unref();
  return { jobId, logFile: job.logFile };
}
