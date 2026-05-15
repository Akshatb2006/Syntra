export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
}

export interface SearchPort {
  /**
   * Web search for the geo intelligence agent. Should return results suitable
   * for "<locality> <keyword>" style queries.
   */
  search(query: string, opts?: { maxResults?: number }): Promise<SearchResult[]>;
}
