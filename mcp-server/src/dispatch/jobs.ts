import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, createWriteStream, type WriteStream } from "node:fs";
import { config } from "../config.js";
import type { DispatchJobStatus } from "@growth/shared/types";

const DISPATCH_LOG_DIR = join(config.logDir, "dispatch");
mkdirSync(DISPATCH_LOG_DIR, { recursive: true });

export interface ActiveJob extends DispatchJobStatus {
  logFile: string;
  logStream: WriteStream;
  cancel: () => void;
}

const jobs = new Map<string, ActiveJob>();

export const jobStore = {
  dir: DISPATCH_LOG_DIR,
  newJobId(): string {
    return randomUUID();
  },
  create(
    jobId: string,
    init: Omit<
      DispatchJobStatus,
      "jobId" | "status" | "startedAt" | "endedAt" | "exitCode" | "prNumber" | "prUrl"
    >,
    cancel: () => void,
  ): ActiveJob {
    const logFile = join(DISPATCH_LOG_DIR, `${jobId}.log`);
    const job: ActiveJob = {
      ...init,
      jobId,
      status: "running",
      startedAt: Date.now(),
      endedAt: null,
      exitCode: null,
      prNumber: null,
      prUrl: null,
      logFile,
      logStream: createWriteStream(logFile, { flags: "a" }),
      cancel,
    };
    jobs.set(jobId, job);
    return job;
  },
  get(jobId: string): ActiveJob | undefined {
    return jobs.get(jobId);
  },
  update(jobId: string, patch: Partial<DispatchJobStatus>): ActiveJob | undefined {
    const j = jobs.get(jobId);
    if (!j) return undefined;
    Object.assign(j, patch);
    return j;
  },
  finish(
    jobId: string,
    exitCode: number,
    status: "succeeded" | "failed" | "cancelled",
  ): ActiveJob | undefined {
    const j = jobs.get(jobId);
    if (!j) return undefined;
    j.exitCode = exitCode;
    j.status = status;
    j.endedAt = Date.now();
    try {
      j.logStream.end(
        `\n=== Job ${jobId} ${status} (exit ${exitCode}) ${new Date().toISOString()} ===\n`,
      );
    } catch {
      // best-effort
    }
    return j;
  },
  toStatus(j: ActiveJob): DispatchJobStatus {
    return {
      jobId: j.jobId,
      runId: j.runId,
      status: j.status,
      exitCode: j.exitCode,
      startedAt: j.startedAt,
      endedAt: j.endedAt,
      prNumber: j.prNumber,
      prUrl: j.prUrl,
      branchName: j.branchName,
    };
  },
};
