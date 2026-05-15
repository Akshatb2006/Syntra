import { Router } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { bearerAuth } from "../auth/bearer.js";
import { plugins } from "../plugins/loader.js";
import { logger } from "../lib/logger.js";

export function mcpRouter(): Router {
  const router = Router();
  const transports = new Map<string, StreamableHTTPServerTransport>();

  router.post("/mcp", bearerAuth, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res, req.body);
      return;
    }

    const server = new McpServer({
      name: "growth-engineer-mcp",
      version: "0.1.0",
    });
    for (const plugin of plugins) {
      plugin.register(server, { username: req.username ?? "anonymous" });
    }

    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id: string) => {
        transports.set(id, transport);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
        logger.debug("mcp_session_closed", { sessionId: transport.sessionId });
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  router.get("/mcp", bearerAuth, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).json({ error: "Invalid or missing session" });
      return;
    }
    await transport.handleRequest(req, res);
  });

  router.delete("/mcp", bearerAuth, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (transport) {
      await transport.handleRequest(req, res);
      transports.delete(sessionId!);
      res.end();
      return;
    }
    res.status(204).end();
  });

  return router;
}
