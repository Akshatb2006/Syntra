import { randomBytes, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  const r = randomBytes(8).toString("hex");
  return `${prefix}_${r}`;
}

/**
 * Trace and span IDs are emitted as RFC 4122 UUIDs because the Omium ingestion
 * endpoint (and most OpenTelemetry-compatible backends) validate them as such.
 */
export function newTraceId(): string {
  return randomUUID();
}

export function newSpanId(): string {
  return randomUUID();
}
