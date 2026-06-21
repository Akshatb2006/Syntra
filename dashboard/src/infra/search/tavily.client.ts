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
 * Honest no-op search. When no search provider is configured we return NO
 * results rather than fabricating any — local intelligence then relies solely
 * on the model's own knowledge, and search is reported as unavailable. We never
 * invent search results: investors forgive limitations, not fabricated output.
 */
export class UnavailableSearchClient implements SearchPort {
  private warned = false;
  async search(): Promise<SearchResult[]> {
    if (!this.warned) {
      logger.warn("search_unavailable", {
        reason: "no TAVILY_API_KEY configured — returning no results",
      });
      this.warned = true;
    }
    return [];
  }
}

export function getSearch(): SearchPort {
  return env.tavilyKey ? new TavilySearchClient() : new UnavailableSearchClient();
}
