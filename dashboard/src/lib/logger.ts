type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, event: string, data?: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), level, event, ...(data ?? {}) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (e: string, d?: Record<string, unknown>) => emit("debug", e, d),
  info: (e: string, d?: Record<string, unknown>) => emit("info", e, d),
  warn: (e: string, d?: Record<string, unknown>) => emit("warn", e, d),
  error: (e: string, d?: Record<string, unknown>) => emit("error", e, d),
};
