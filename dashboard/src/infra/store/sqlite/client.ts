import Database, { type Database as Db } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "@/lib/env";
import { SCHEMA_SQL } from "./schema";

let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  mkdirSync(dirname(env.sqlitePath), { recursive: true });
  db = new Database(env.sqlitePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  // Idempotent forward migrations for columns added after initial release.
  // SQLite throws on duplicate column — we swallow that case only.
  const safeAlter = (sql: string) => {
    try {
      db!.exec(sql);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/duplicate column name/i.test(msg)) throw e;
    }
  };
  safeAlter("ALTER TABLE runs ADD COLUMN credentials_ref TEXT NOT NULL DEFAULT ''");
  // Engine/detector version stamps. Default 'v0' marks every pre-versioning run
  // as legacy — it keeps representing what Syntra believed when it ran.
  safeAlter("ALTER TABLE runs ADD COLUMN engine_version TEXT NOT NULL DEFAULT 'v0'");
  safeAlter("ALTER TABLE runs ADD COLUMN detector_version TEXT NOT NULL DEFAULT 'v0'");
  // Desktop-form-factor Lighthouse baseline (mobile lives in baseline_lh_json).
  // Nullable — legacy runs and any run whose desktop pass failed simply have none.
  safeAlter("ALTER TABLE runs ADD COLUMN baseline_lh_desktop_json TEXT");
  // Deficit-centric suggestion fields (issue / measured evidence / implementation).
  safeAlter("ALTER TABLE suggestions ADD COLUMN issue TEXT NOT NULL DEFAULT ''");
  safeAlter("ALTER TABLE suggestions ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]'");
  safeAlter("ALTER TABLE suggestions ADD COLUMN implementation TEXT NOT NULL DEFAULT ''");
  // Finding confidence/provenance (0..1). Default 1 keeps legacy rows neutral.
  safeAlter("ALTER TABLE suggestions ADD COLUMN confidence REAL NOT NULL DEFAULT 1");
  // Business-aware enrichment (why it matters / business outcome). Nullable —
  // legacy suggestions simply render without the Business Insight block.
  safeAlter("ALTER TABLE suggestions ADD COLUMN why_it_matters TEXT");
  safeAlter("ALTER TABLE suggestions ADD COLUMN business_impact TEXT");
  // Demand-validation signal for content-gap entities (band/score/intent/
  // competitor ownership). Nullable — non-gap or pre-demand rows render without it.
  safeAlter("ALTER TABLE suggestions ADD COLUMN demand_json TEXT");
  // Decomposed opportunity score (impact/demand/competitive gap/effort/confidence
  // → priority). Nullable — pre-scoring-v2 rows render with priorityScore only.
  safeAlter("ALTER TABLE suggestions ADD COLUMN opportunity_json TEXT");
  // Buildable page blueprint (title/sections/keywords) for content-gap rows.
  // Nullable — non-gap or un-blueprinted rows render without it.
  safeAlter("ALTER TABLE suggestions ADD COLUMN blueprint_json TEXT");
  // Run ownership for per-user isolation (added with auth). Nullable — pre-auth
  // runs are unowned and invisible to every signed-in user.
  safeAlter("ALTER TABLE runs ADD COLUMN owner TEXT");
  // Index created here (not in SCHEMA_SQL) so it runs only after the owner column
  // exists — on a pre-auth DB the column is added by the ALTER just above.
  db.exec("CREATE INDEX IF NOT EXISTS idx_runs_owner ON runs(owner, created_at DESC)");
  return db;
}
