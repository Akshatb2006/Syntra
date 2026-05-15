import { Router } from "express";
import { readFile, stat } from "node:fs/promises";
import { bearerAuth, requireUsername } from "../auth/bearer.js";
import { dispatchCodeEditRequestSchema } from "@growth/shared/schemas";
import { dispatchCodeEdit } from "../dispatch/code-edit.js";
import { jobStore } from "../dispatch/jobs.js";
import { AppError, isAppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function dispatchRouter(): Router {
  const router = Router();

  router.post("/dispatch/code-edit", bearerAuth, async (req, res) => {
    try {
      const username = requireUsername(req);
      const parsed = dispatchCodeEditRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          error: "Invalid request",
          issues: parsed.error.flatten(),
        });
        return;
      }
      // GitHub token is supplied via header by dashboard (sensitive — not in body).
      const githubToken =
        (req.headers["x-github-token"] as string | undefined) ?? "";
      if (!githubToken) {
        throw new AppError(
          "BAD_REQUEST",
          "Missing X-GitHub-Token header",
        );
      }
      const result = dispatchCodeEdit({
        ...parsed.data,
        username,
        githubToken,
      });
      res.status(202).json({
        jobId: result.jobId,
        status: "dispatched" as const,
        logUrl: `/dispatch/code-edit/${result.jobId}/log`,
      });
    } catch (err) {
      if (isAppError(err)) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      logger.error("dispatch_route_error", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Internal error" });
    }
  });

  router.get("/dispatch/code-edit/:jobId/status", bearerAuth, async (req, res) => {
    const jobId = String(req.params.jobId ?? "");
    const j = jobStore.get(jobId);
    if (!j) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(jobStore.toStatus(j));
  });

  router.get("/dispatch/code-edit/:jobId/log", bearerAuth, async (req, res) => {
    const jobId = String(req.params.jobId ?? "");
    if (!/^[a-f0-9-]{36}$/i.test(jobId)) {
      res.status(400).json({ error: "Invalid jobId" });
      return;
    }
    const j = jobStore.get(jobId);
    const path = j?.logFile ?? `${jobStore.dir}/${jobId}.log`;
    try {
      await stat(path);
    } catch {
      res.status(404).json({ error: "Log not found" });
      return;
    }
    const content = await readFile(path, "utf-8");
    res.type("text/plain").send(content);
  });

  return router;
}
