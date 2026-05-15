import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { githubPushSchema } from "@growth/shared/schemas";
import { eventBus } from "../events/bus.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

export function verifyGithubSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): void {
  if (!config.githubWebhookSecret) {
    throw new AppError(
      "WEBHOOK_SIGNATURE_INVALID",
      "GITHUB_WEBHOOK_SECRET not configured",
    );
  }
  if (!signatureHeader?.startsWith("sha256=")) {
    throw new AppError(
      "WEBHOOK_SIGNATURE_INVALID",
      "Missing X-Hub-Signature-256",
    );
  }
  const expected = createHmac("sha256", config.githubWebhookSecret)
    .update(rawBody)
    .digest("hex");
  const presented = signatureHeader.slice("sha256=".length);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(presented, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("WEBHOOK_SIGNATURE_INVALID", "Signature mismatch");
  }
}

export function handleGithubWebhook(
  eventType: string,
  deliveryId: string,
  body: unknown,
): void {
  if (eventType !== "push") {
    logger.debug("github_webhook_ignored", { eventType, deliveryId });
    return;
  }
  const parsed = githubPushSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("github_webhook_invalid", {
      eventType,
      issues: parsed.error.flatten(),
    });
    return;
  }
  const push = parsed.data;
  logger.info("github_push_received", {
    deliveryId,
    repo: push.repository.full_name,
    ref: push.ref,
    commits: push.commits.length,
  });
  eventBus.publish({
    type: "webhook.received",
    source: "github",
    eventType: "push",
    runId: null,
    at: Date.now(),
  });
}
