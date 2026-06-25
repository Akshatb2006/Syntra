/**
 * Server-only session helpers (read/set/clear the cookie via next/headers).
 * Kept separate from session.ts so middleware — which can't use next/headers —
 * imports only the pure crypto. `set`/`clear` work only in Route Handlers and
 * Server Actions; `getSession` reads anywhere on the server. (next/headers
 * already throws if imported into a Client Component, so this stays server-only.)
 */
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function setSession(partial: Omit<SessionPayload, "exp">): Promise<void> {
  const token = await signSession(partial);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(env.authUrl.startsWith("https")));
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
