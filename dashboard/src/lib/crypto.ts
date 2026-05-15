import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { env } from "./env";

/**
 * AES-256-GCM symmetric encryption for credentials at rest in the secrets table.
 * Key is from SECRETS_ENC_KEY env (hex). Falls back to a derived dev key if absent
 * — never use a fallback in production.
 */

function getKey(): Buffer {
  if (env.secretsEncKey) {
    const buf = Buffer.from(env.secretsEncKey, "hex");
    if (buf.length === 32) return buf;
  }
  return createHash("sha256").update("growth-engineer-dev-fallback").digest();
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed ciphertext");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
