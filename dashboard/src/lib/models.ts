import { AGENTS } from "@growth/shared/constants";
import type { AgentName } from "@growth/shared/types";
import { env } from "./env";

/**
 * Resolves the model for an agent: a per-agent env override (e.g.
 * ORCHESTRATOR_MODEL) wins, otherwise the default declared in AGENTS (shared).
 *
 * This is the single tuning surface for the cost/speed-vs-quality tradeoff —
 * flip an agent back to Opus from .env without touching code or rebuilding the
 * shared package.
 */
export function modelFor(name: AgentName): string {
  const override = env.modelOverrides[name];
  return override && override.length > 0 ? override : AGENTS[name].model;
}
