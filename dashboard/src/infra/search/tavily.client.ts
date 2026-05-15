import type { SearchPort, SearchResult } from "@/core/ports/search.port";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

interface TavilyResponse {
  results: Array<{ title: string; url: string; content: string; score: number }>;
}

export class TavilySearchClient implements SearchPort {
  async search(query: string, opts?: { maxResults?: number }): Promise<SearchResult[]> {
    if (!env.tavilyKey) return [];
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: env.tavilyKey,
          query,
          search_depth: "basic",
          max_results: opts?.maxResults ?? 7,
        }),
      });
      if (!res.ok) {
        logger.warn("tavily_failed", { status: res.status });
        return [];
      }
      const data = (await res.json()) as TavilyResponse;
      return data.results.map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.content,
        score: r.score,
      }));
    } catch (err) {
      logger.warn("tavily_error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}

/**
 * Stub fallback — returns plausible-looking results so the geo agent can still
 * run when no search provider is configured. Demo-safe; should not ship as-is
 * if a real provider is available.
 */
export class StubSearchClient implements SearchPort {
  async search(query: string): Promise<SearchResult[]> {
    const tokens = query.toLowerCase().match(/[a-z]+/g) ?? [];
    const locality = tokens.find((t) =>
      ["whitefield", "sarjapur", "indiranagar", "koramangala", "electronic", "devanahalli"].includes(t),
    );
    return [
      {
        title: `Best ${locality ?? "Bangalore"} apartments — guide`,
        url: `https://example.com/${locality ?? "bangalore"}-guide`,
        snippet: `An overview of ${locality ?? "Bangalore"} as a residential locality, schools, transit, top builders, and price trends.`,
      },
      {
        title: `${locality ?? "Bangalore"} — nearby landmarks and metro connectivity`,
        url: `https://example.com/${locality ?? "bangalore"}-landmarks`,
        snippet: `Key landmarks near ${locality ?? "Bangalore"}: tech parks, metro stations, shopping, schools, hospitals.`,
      },
    ];
  }
}

export function getSearch(): SearchPort {
  return env.tavilyKey ? new TavilySearchClient() : new StubSearchClient();
}
