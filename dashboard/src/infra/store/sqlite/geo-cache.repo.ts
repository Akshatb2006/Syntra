import type { GeoCacheRepoPort } from "@/core/ports/store.port";
import { getDb } from "./client";

interface Row {
  cache_key: string;
  city: string;
  value_json: string;
  created_at: number;
}

export const geoCacheRepo: GeoCacheRepoPort = {
  get<T>(key: string, maxAgeMs?: number) {
    const row = getDb()
      .prepare("SELECT * FROM geo_cache WHERE cache_key = ?")
      .get(key) as Row | undefined;
    if (!row) return null;
    if (maxAgeMs !== undefined && Date.now() - row.created_at > maxAgeMs) {
      return null;
    }
    return { value: JSON.parse(row.value_json) as T, createdAt: row.created_at };
  },
  set<T>(key: string, city: string, value: T) {
    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO geo_cache (cache_key, city, value_json, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET value_json = excluded.value_json, created_at = excluded.created_at`,
      )
      .run(key, city, JSON.stringify(value), now);
  },
};
