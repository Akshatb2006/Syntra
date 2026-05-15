import { getMcp } from "@/infra/mcp/http.client";
import { eventBus } from "./local.bus";
import type { PlatformEvent } from "@growth/shared/types";
import { logger } from "@/lib/logger";

/**
 * Subscribe to MCP's SSE stream and forward each event into the local bus.
 * Started once when the orchestrator pipeline boots — webhooks and dispatch
 * progress fired on the MCP side become visible to the dashboard UI.
 */
let started = false;
let stop: (() => void) | null = null;

export function startMcpSubscriber(): void {
  if (started) return;
  started = true;
  stop = getMcp().subscribeEvents((raw) => {
    if (!raw || typeof raw !== "object") return;
    const t = (raw as { type?: unknown }).type;
    if (typeof t !== "string") return;
    if (t === "_hello") return;
    eventBus.publish(raw as PlatformEvent);
  });
  logger.info("mcp_subscriber_started");
}

export function stopMcpSubscriber(): void {
  stop?.();
  stop = null;
  started = false;
}
