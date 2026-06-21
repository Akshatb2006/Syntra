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
  // Deficit-centric suggestion fields (issue / measured evidence / implementation).
  safeAlter("ALTER TABLE suggestions ADD COLUMN issue TEXT NOT NULL DEFAULT ''");
  safeAlter("ALTER TABLE suggestions ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]'");
  safeAlter("ALTER TABLE suggestions ADD COLUMN implementation TEXT NOT NULL DEFAULT ''");
  // Finding confidence/provenance (0..1). Default 1 keeps legacy rows neutral.
  safeAlter("ALTER TABLE suggestions ADD COLUMN confidence REAL NOT NULL DEFAULT 1");
  return db;
}
