import { Router, raw } from "express";
import {
  verifyGithubSignature,
  handleGithubWebhook,
} from "../webhooks/github.js";
import {
  verifyVercelSignature,
  handleVercelWebhook,
} from "../webhooks/vercel.js";
import { isAppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function webhookRouter(): Router {
  const router = Router();

  router.post(
    "/webhooks/github",
    raw({ type: "application/json", limit: "5mb" }),
    (req, res) => {
      try {
        const buf = req.body as Buffer;
        verifyGithubSignature(
          buf,
          req.header("x-hub-signature-256") ?? undefined,
        );
        const eventType = req.header("x-github-event") ?? "unknown";
        const deliveryId = req.header("x-github-delivery") ?? "";
        const body = JSON.parse(buf.toString("utf-8")) as unknown;
        handleGithubWebhook(eventType, deliveryId, body);
        res.status(202).json({ accepted: true });
      } catch (err) {
        if (isAppError(err)) {
          res.status(err.status).json({ error: err.message, code: err.code });
          return;
        }
        logger.error("github_webhook_error", {
          error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: "Internal" });
      }
    },
  );

  router.post(
    "/webhooks/vercel",
    raw({ type: "application/json", limit: "5mb" }),
    (req, res) => {
      try {
        const buf = req.body as Buffer;
        verifyVercelSignature(buf, req.header("x-vercel-signature") ?? undefined);
        const body = JSON.parse(buf.toString("utf-8")) as unknown;
        handleVercelWebhook(body);
        res.status(202).json({ accepted: true });
      } catch (err) {
        if (isAppError(err)) {
          res.status(err.status).json({ error: err.message, code: err.code });
          return;
        }
        logger.error("vercel_webhook_error", {
          error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: "Internal" });
      }
    },
  );

  return router;
}
