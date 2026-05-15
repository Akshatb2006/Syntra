import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { vercelDeploymentSchema } from "@growth/shared/schemas";
import { eventBus } from "../events/bus.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

export function verifyVercelSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): void {
  if (!config.vercelWebhookSecret) {
    throw new AppError(
      "WEBHOOK_SIGNATURE_INVALID",
      "VERCEL_WEBHOOK_SECRET not configured",
    );
  }
  if (!signatureHeader) {
    throw new AppError(
      "WEBHOOK_SIGNATURE_INVALID",
      "Missing x-vercel-signature header",
    );
  }
  const expected = createHmac("sha1", config.vercelWebhookSecret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signatureHeader, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("WEBHOOK_SIGNATURE_INVALID", "Signature mismatch");
  }
}

export function handleVercelWebhook(body: unknown): void {
  const parsed = vercelDeploymentSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("vercel_webhook_invalid", { issues: parsed.error.flatten() });
    return;
  }
  const evt = parsed.data;
  logger.info("vercel_webhook_received", {
    type: evt.type,
    deploymentId: evt.payload.deployment.id,
    project: evt.payload.project.name,
  });
  eventBus.publish({
    type: "webhook.received",
    source: "vercel",
    eventType: evt.type,
    runId: null,
    at: Date.now(),
  });
  if (evt.type === "deployment.succeeded") {
    eventBus.publish({
      type: "preview.ready",
      runId: "",
      previewUrl: `https://${evt.payload.deployment.url}`,
      at: Date.now(),
    });
  }
}
