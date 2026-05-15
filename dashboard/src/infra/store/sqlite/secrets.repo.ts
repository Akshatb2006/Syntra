import type { SecretsRepoPort } from "@/core/ports/store.port";
import type { Credentials } from "@growth/shared/schemas";
import { encrypt, decrypt } from "@/lib/crypto";
import { getDb } from "./client";

interface Row {
  id: string;
  ciphertext: string;
  created_at: number;
  updated_at: number;
}

export const secretsRepo: SecretsRepoPort = {
  upsert(id, creds) {
    const now = Date.now();
    const ct = encrypt(JSON.stringify(creds));
    getDb()
      .prepare(
        `INSERT INTO secrets (id, ciphertext, created_at, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET ciphertext = excluded.ciphertext, updated_at = excluded.updated_at`,
      )
      .run(id, ct, now, now);
  },
  get(id) {
    const row = getDb()
      .prepare("SELECT * FROM secrets WHERE id = ?")
      .get(id) as Row | undefined;
    if (!row) return null;
    return JSON.parse(decrypt(row.ciphertext)) as Credentials;
  },
  delete(id) {
    getDb().prepare("DELETE FROM secrets WHERE id = ?").run(id);
  },
};
