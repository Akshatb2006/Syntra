import type { TracerPort } from "@/core/ports/tracer.port";
import { ConsoleTracer } from "./console.tracer";
import { SqliteTracer } from "./sqlite.tracer";
import { OmiumTracer } from "./omium.tracer";
import { CompositeTracer } from "./composite.tracer";

/**
 * Default tracer = Console + SQLite + Omium (Omium becomes a no-op if not configured).
 * The composite uses the FIRST tracer to mint trace/span IDs; SQLite is canonical
 * so it owns ID generation, which lets the dashboard render the trace tree from
 * local state without needing Omium to be reachable.
 */
let cached: TracerPort | null = null;

export function getTracer(): TracerPort {
  if (cached) return cached;
  cached = new CompositeTracer([
    new SqliteTracer(),
    new ConsoleTracer(),
    new OmiumTracer(),
  ]);
  return cached;
}
