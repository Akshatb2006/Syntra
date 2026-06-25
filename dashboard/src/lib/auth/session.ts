/**
 * Signed session tokens, built on Web Crypto (HMAC-SHA256) so the SAME code runs
 * in the Edge middleware runtime AND Node route handlers — no `node:crypto`, no
 * dependency. The token is a compact `payloadB64url.signatureB64url` string; the
 * signature is verified and the expiry checked on every read. This file is
 * intentionally free of `next/headers` and any DB import so middleware can use it.
 */

export interface SessionPayload {
  /** User id (our users table id). */
  uid: string;
  email: string;
  name: string;
  /** Whether onboarding (company/website/role) is complete. */
  onb: boolean;
  /** Expiry, epoch seconds. */
  exp: number;
}

export const SESSION_COOKIE = "syntra_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

/** Cookie attributes shared by set + clear. Secure only matters under HTTPS. */
export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const, // lax so the OAuth redirect back carries the cookie
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  };
}

// Dev fallback secret — fine for localhost, NEVER for a real deployment. We warn
// once if it's used so it can't silently ship to production.
const DEV_SECRET = "syntra-dev-insecure-session-secret-change-me";
let warnedDevSecret = false;

function secretString(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length > 0) return s;
  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn(
      "[auth] AUTH_SECRET is not set — using an insecure dev key. Set AUTH_SECRET before deploying.",
    );
  }
  return DEV_SECRET;
}

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bytes(secretString()) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Build a signed token for a session that expires in SESSION_MAX_AGE_S. */
export async function signSession(
  partial: Omit<SessionPayload, "exp">,
): Promise<string> {
  const payload: SessionPayload = {
    ...partial,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S,
  };
  const payloadB64 = b64urlEncodeBytes(bytes(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, bytes(payloadB64) as BufferSource),
  );
  return `${payloadB64}.${b64urlEncodeBytes(sig)}`;
}

/** Verify signature + expiry; return the payload or null. Never throws. */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  try {
    const key = await hmacKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecodeBytes(sigB64) as BufferSource,
      bytes(payloadB64) as BufferSource,
    );
    if (!ok) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecodeBytes(payloadB64)),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
