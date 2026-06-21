import type { AgentName } from "../types/agent.js";

export const AGENTS: Record<AgentName, { displayName: string; model: string; description: string }> = {
  orchestrator: {
    displayName: "Orchestrator",
    model: "claude-opus-4-7",
    description: "Plans the run, decomposes work, dispatches sub-agents, decides completion.",
  },
  crawl_seo: {
    displayName: "Crawl & SEO Audit",
    model: "claude-sonnet-4-6",
    description: "Crawls the site, runs Lighthouse, extracts metadata/schema/structure, identifies SEO gaps.",
  },
  geo_intel: {
    displayName: "Geo Intelligence",
    model: "claude-haiku-4-5",
    description: "Discovers locality keywords, neighborhood landmarks, and geo-intent SEO opportunities.",
  },
  enrichment: {
    displayName: "Recommendation Enrichment",
    model: "claude-opus-4-7",
    description: "Explains each detected deficit for THIS business — why it matters and the outcome it affects. Cannot invent findings.",
  },
  code_mod: {
    displayName: "Code Modification",
    model: "claude-opus-4-7",
    description: "Applies fixes via Claude Code on a feature branch, opens a pull request.",
  },
  validation: {
    displayName: "Validation",
    model: "claude-sonnet-4-6",
    description: "Re-runs Lighthouse on Vercel preview, computes delta, flags regressions.",
  },
};

export const AGENT_ORDER: AgentName[] = [
  "orchestrator",
  "crawl_seo",
  "geo_intel",
  "enrichment",
  "code_mod",
  "validation",
];
