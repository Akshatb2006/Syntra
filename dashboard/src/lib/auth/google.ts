/**
 * Minimal Google OAuth (authorization-code flow), zero dependencies. Server-side
 * only. The id_token is read directly from Google's token endpoint over our own
 * TLS exchange (confidential client + client_secret), so its claims are trusted
 * without re-verifying the JWT signature.
 */
import { env } from "@/lib/env";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export function googleRedirectUri(): string {
  return `${env.authUrl}/api/auth/callback/google`;
}

/** Build the consent-screen URL. `state` is the CSRF token we round-trip. */
export function googleConsentUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env.googleClientId ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${p.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId ?? "",
      client_secret: env.googleClientSecret ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("Google token response missing id_token");
  return decodeIdToken(data.id_token);
}

function decodeIdToken(idToken: string): GoogleProfile {
  const parts = idToken.split(".");
  if (parts.length < 2) throw new Error("Malformed id_token");
  const claims = JSON.parse(b64urlToString(parts[1])) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!claims.email) throw new Error("Google id_token missing email");
  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name ?? claims.email,
    picture: claims.picture,
  };
}

function b64urlToString(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
