import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";

type Level = "debug" | "info" | "warn" | "error";

mkdirSync(config.logDir, { recursive: true });

function writeLine(line: string): void {
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    appendFileSync(join(config.logDir, `${dateStr}.log`), line + "\n");
  } catch {
    // best-effort
  }
}

function emit(level: Level, event: string, data?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(data ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else console.log(line);
  writeLine(line);
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) =>
    config.nodeEnv !== "production" && emit("debug", event, data),
  info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),
  child: (bindings: Record<string, unknown>) => ({
    debug: (event: string, data?: Record<string, unknown>) =>
      logger.debug(event, { ...bindings, ...(data ?? {}) }),
    info: (event: string, data?: Record<string, unknown>) =>
      logger.info(event, { ...bindings, ...(data ?? {}) }),
    warn: (event: string, data?: Record<string, unknown>) =>
      logger.warn(event, { ...bindings, ...(data ?? {}) }),
    error: (event: string, data?: Record<string, unknown>) =>
      logger.error(event, { ...bindings, ...(data ?? {}) }),
  }),
};

export type Logger = typeof logger;
