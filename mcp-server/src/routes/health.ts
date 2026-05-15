import { Router } from "express";
import { config } from "../config.js";
import { plugins } from "../plugins/loader.js";

export function healthRouter(): Router {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "growth-engineer-mcp",
      version: "0.1.0",
      plugins: plugins.map((p) => p.name),
      users: config.validTokens.size,
      uptimeSec: Math.round(process.uptime()),
    });
  });
  return router;
}
