/**
 * Standalone worker entry. The dashboard's API routes already kick off the
 * pipeline in-process when a run is created, so a dedicated worker isn't
 * strictly required for the demo. This file exists for the case where the
 * Next.js process is restarted mid-run: it boots the cross-cutting subscribers
 * and keeps the process alive so future requests resume cleanly.
 *
 * Usage: `pnpm worker:start`
 */
import { startMcpSubscriber } from "@/infra/eventbus/mcp-sse.subscriber";
import { logger } from "@/lib/logger";

startMcpSubscriber();
logger.info("worker_started", { pid: process.pid });

// Keep alive.
setInterval(() => {
  // heartbeat
}, 60_000);

process.on("SIGTERM", () => {
  logger.info("worker_stopping");
  process.exit(0);
});
