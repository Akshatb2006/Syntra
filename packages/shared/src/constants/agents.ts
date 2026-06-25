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
  site_understanding: {
    displayName: "Site Understanding",
    model: "claude-sonnet-4-6",
    description: "Classifies page types for THIS business, extracts the entities the site talks about, and detects content gaps (entities mentioned heavily but with no dedicated page).",
  },
  geo_intel: {
    displayName: "Geo Intelligence",
    model: "claude-haiku-4-5",
    description: "Discovers locality keywords, neighborhood landmarks, and geo-intent SEO opportunities.",
  },
  demand_intel: {
    displayName: "Demand Validation",
    model: "claude-haiku-4-5",
    description: "Validates whether the entities a site mentions actually attract search demand — observing SERP presence, competitor ownership, and commercial vs regulatory intent so buildable gaps outrank dead ones.",
  },
  competitor_intel: {
    displayName: "Competitor Intelligence",
    model: "claude-haiku-4-5",
    description: "Observes the business's competitor set and the dedicated pages/topics they own — surfacing the gaps competitors have built and the target hasn't (including topics the site doesn't yet cover).",
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
  "site_understanding",
  "geo_intel",
  "demand_intel",
  "competitor_intel",
  "enrichment",
  "code_mod",
  "validation",
];
