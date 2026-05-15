import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { healthRouter } from "../routes/health.js";
import { mcpRouter } from "../routes/mcp.routes.js";
import { eventsRouter } from "../routes/events.routes.js";
import { dispatchRouter } from "../routes/dispatch.routes.js";
import { webhookRouter } from "../routes/webhook.routes.js";
import { logger } from "../lib/logger.js";
import { isAppError } from "../lib/errors.js";

export function createApp(): Express {
  const app = express();

  // Webhooks (raw body) registered BEFORE JSON parser.
  app.use(webhookRouter());

  app.use(express.json({ limit: "5mb" }));

  app.use((req, _res, next) => {
    logger.debug("request", { method: req.method, path: req.path });
    next();
  });

  app.use(healthRouter());
  app.use(eventsRouter());
  app.use(dispatchRouter());
  app.use(mcpRouter());

  app.use((req, res) => {
    res.status(404).json({ error: "Not found", path: req.path });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(err)) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    logger.error("unhandled_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}
