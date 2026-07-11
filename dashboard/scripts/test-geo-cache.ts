/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Local smoke test for the geo-intel cache. Verifies:
 *   A) the geo_cache repo round-trips a value
 *   B) GeoIntelAgent short-circuits on cache hit (the LLM mock would THROW if
 *      the agent actually called the LLM — proving the cache short-circuits)
 *
 * Run with:  pnpm tsx scripts/test-geo-cache.ts
 * Safe to delete after verifying — does not touch production data beyond
 * writing one row to the geo_cache table (and removing it on success).
 */
import { sqliteStore } from "@/infra/store/sqlite";
import { GeoIntelAgent } from "@/agents/geo-intel.agent";
import type { LlmPort } from "@/core/ports/llm.port";
import type { SearchPort } from "@/core/ports/search.port";
import type { TracerPort, SpanHandle } from "@/core/ports/tracer.port";
import type { EventBusPort } from "@/core/ports/eventbus.port";

const CITY = "test-bangalore-cache-probe";
const LOCALITIES = ["Whitefield", "Sarjapur Road"];
const CACHE_KEY = `${CITY.trim().toLowerCase()}|${[...LOCALITIES].sort().join(",")}`;

const FAKE_OUTPUT = {
  byLocality: {
    Whitefield: {
      locality: "Whitefield",
      city: CITY,
      landmarks: ["Phoenix Marketcity"],
      searchIntents: ["2BHK near Whitefield metro"],
      keywordCluster: ["whitefield apartments", "wf flat"],
    },
    "Sarjapur Road": {
      locality: "Sarjapur Road",
      city: CITY,
      landmarks: ["Wipro campus"],
      searchIntents: ["apartments near Sarjapur Wipro"],
      keywordCluster: ["sarjapur flat", "sarjapur apartments"],
    },
  },
  topOpportunities: [
    { locality: "Whitefield", score: 91, rationale: "Stub" },
  ],
};

// ---- Mocks ----
const stubSpan: SpanHandle = {
  traceId: "test-trace",
  spanId: "test-span",
  runId: null,
  setAttribute() {},
  addEvent() {},
  end() {},
};
const tracer: TracerPort = {
  startSpan: () => stubSpan,
  withSpan: async (_opts, fn) => fn(stubSpan),
};
const events: EventBusPort = {
  publish() {},
  subscribe: () => () => {},
  recent: () => [],
};
// LLM mock — THROWS on any call. If the agent calls it, the test FAILS.
const llm: LlmPort = {
  async call(_input) {
    throw new Error(
      "LLM was called — cache short-circuit failed. The agent should have returned the cached value.",
    );
  },
};
const search: SearchPort = {
  async search() {
    throw new Error("Search was called — cache short-circuit failed.");
  },
};

async function main() {
  console.log("---------- Test A: cache repo round-trip ----------");
  sqliteStore.geoCache.set(CACHE_KEY, CITY, FAKE_OUTPUT);
  const hit = sqliteStore.geoCache.get<typeof FAKE_OUTPUT>(CACHE_KEY);
  if (!hit) throw new Error("FAIL: cache miss after set()");
  if (hit.value.topOpportunities[0]?.locality !== "Whitefield") {
    throw new Error("FAIL: round-trip data mismatch");
  }
  console.log("  PASS  set() → get() round-trip works");
  console.log(`        createdAt = ${new Date(hit.createdAt).toISOString()}`);

  console.log("\n---------- Test B: TTL filter ----------");
  // Set a row, then fetch with a 0ms TTL — should be treated as expired.
  sqliteStore.geoCache.set(CACHE_KEY, CITY, FAKE_OUTPUT);
  await new Promise((r) => setTimeout(r, 5));
  const expired = sqliteStore.geoCache.get(CACHE_KEY, 1); // 1ms max age
  if (expired !== null) throw new Error("FAIL: TTL not enforced");
  console.log("  PASS  expired entries return null when maxAgeMs is too tight");

  console.log("\n---------- Test C: agent short-circuits on cache hit ----------");
  sqliteStore.geoCache.set(CACHE_KEY, CITY, FAKE_OUTPUT);

  // Agent insists on inserting an agent_step row, which has a FK to runs.
  // Create a probe run so the FK passes, clean it up at the end.
  const TEST_RUN_ID = "run_geo_cache_probe";
  sqliteStore.runs.insert({
    id: TEST_RUN_ID,
    owner: null,
    input: {
      siteUrl: "https://test.example.com",
      repoUrl: "https://github.com/x/y",
      trigger: { kind: "manual", userId: "probe" },
    },
    status: "queued",
    engineVersion: "test",
    detectorVersion: "test",
    credentialsRef: "",
    workspaceId: "ws-probe",
    prUrl: null,
    previewUrl: null,
    baselineLighthouse: null,
    baselineLighthouseDesktop: null,
    afterLighthouse: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
  });

  const agent = new GeoIntelAgent(search);
  const ctx = {
    runId: TEST_RUN_ID,
    parentSpan: null,
    tracer,
    store: sqliteStore,
    events,
    llm,
  };
  const t0 = Date.now();
  const result = await agent.run(ctx, {
    city: CITY,
    localities: LOCALITIES,
    siteUrl: "https://test.example.com",
    industry: "Real Estate",
  });
  const elapsed = Date.now() - t0;
  if (result.topOpportunities[0]?.locality !== "Whitefield") {
    throw new Error("FAIL: agent did not return cached value");
  }
  if (elapsed > 500) {
    throw new Error(
      `FAIL: agent took ${elapsed}ms — expected <500ms for a cache hit`,
    );
  }
  console.log(`  PASS  agent.run() returned cached value in ${elapsed}ms`);
  console.log("        (no LLM/search calls — the THROW mocks were never hit)");

  // Cleanup probe rows.
  try {
    const { getDb } = await import("@/infra/store/sqlite/client");
    const db = getDb();
    db.prepare("DELETE FROM geo_cache WHERE cache_key = ?").run(CACHE_KEY);
    db.prepare("DELETE FROM runs WHERE id = ?").run(TEST_RUN_ID);
    console.log("\n(cleanup) probe rows removed");
  } catch (e) {
    console.warn("(cleanup) could not remove probe rows:", e);
  }

  console.log("\nALL GREEN.");
}

main().catch((e) => {
  console.error("\nTEST FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
