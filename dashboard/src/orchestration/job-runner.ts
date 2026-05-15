import { startMcpSubscriber } from "@/infra/eventbus/mcp-sse.subscriber";
import { logger } from "@/lib/logger";

/**
 * Lazily initialize cross-cutting subscribers when the first run is created.
 * This is idempotent — multiple calls are safe.
 */
let initialized = false;

export function ensureRuntime(): void {
  if (initialized) return;
  initialized = true;
  try {
    startMcpSubscriber();
    logger.info("runtime_initialized");
  } catch (err) {
    logger.warn("runtime_init_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
