import { Router } from "express";
import { bearerAuth } from "../auth/bearer.js";
import { eventBus } from "../events/bus.js";
import { logger } from "../lib/logger.js";

export function eventsRouter(): Router {
  const router = Router();

  router.get("/events", bearerAuth, (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const send = (data: unknown) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        logger.warn("sse_write_failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    };

    send({ type: "_hello", at: Date.now() });
    for (const ev of eventBus.recent(50)) send(ev);

    const unsub = eventBus.subscribe(send);
    const ping = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        // ignore
      }
    }, 15_000);

    req.on("close", () => {
      clearInterval(ping);
      unsub();
      logger.debug("sse_client_disconnected", { user: req.username });
    });
  });

  return router;
}
