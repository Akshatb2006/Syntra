import { createApp } from "./transport/http.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { plugins } from "./plugins/loader.js";

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info("server_start", {
    port: config.port,
    nodeEnv: config.nodeEnv,
    plugins: plugins.map((p) => p.name),
    users: config.validTokens.size,
    publicBaseUrl: config.publicBaseUrl,
    workspaceRoot: config.workspaceRoot,
  });
});

const shutdown = (signal: string) => {
  logger.info("server_shutdown", { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", { error: err.message, stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});
