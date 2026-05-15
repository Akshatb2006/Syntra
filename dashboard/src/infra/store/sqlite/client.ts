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
  return db;
}
