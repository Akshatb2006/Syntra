import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { exchangeCodeForProfile } from "@/lib/auth/google";
import { sqliteStore } from "@/infra/store/sqlite";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;

  // CSRF: the state we round-tripped through Google must match our cookie.
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${env.authUrl}/login?error=oauth_state`);
  }

  try {
    const profile = await exchangeCodeForProfile(code);
    const user = sqliteStore.users.upsertByEmail({
      email: profile.email,
      name: profile.name,
      image: profile.picture ?? null,
    });
    const token = await signSession({
      uid: user.id,
      email: user.email,
      name: user.name,
      onb: user.onboarded,
    });
    const dest = user.onboarded ? `${env.authUrl}/` : `${env.authUrl}/onboarding`;
    const res = NextResponse.redirect(dest);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(env.authUrl.startsWith("https")));
    res.cookies.delete("oauth_state");
    return res;
  } catch (err) {
    logger.error("google_callback_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(`${env.authUrl}/login?error=oauth_failed`);
  }
}
