import type { StorePort } from "@/core/ports/store.port";
import { runsRepo } from "./runs.repo";
import { stepsRepo } from "./steps.repo";
import { tracesRepo } from "./traces.repo";
import { suggestionsRepo } from "./suggestions.repo";
import { secretsRepo } from "./secrets.repo";

export const sqliteStore: StorePort = {
  runs: runsRepo,
  steps: stepsRepo,
  traces: tracesRepo,
  suggestions: suggestionsRepo,
  secrets: secretsRepo,
};
