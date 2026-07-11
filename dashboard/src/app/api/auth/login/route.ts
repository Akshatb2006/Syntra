import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { googleConsentUrl } from "@/lib/auth/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kick off Google OAuth: set a CSRF `state` cookie and redirect to consent. */
export async function GET(req: NextRequest) {
  if (!env.googleConfigured) {
    return NextResponse.redirect(`${env.authUrl}/?authError=google_unconfigured`);
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(googleConsentUrl(state));
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.authUrl.startsWith("https"),
    path: "/",
    maxAge: 600,
  });

  // Optional: a site the visitor wanted audited before signing in. Stash it so
  // the landing can resume the audit after sign-in + onboarding. Not httpOnly —
  // the hero form clears it client-side once consumed. Only accept a valid http(s)
  // URL to avoid smuggling arbitrary values through the cookie.
  const audit = new URL(req.url).searchParams.get("audit");
  if (audit && /^https?:\/\/[^\s]+\.[^\s]+/i.test(audit)) {
    res.cookies.set("pending_audit", audit, {
      httpOnly: false,
      sameSite: "lax",
      secure: env.authUrl.startsWith("https"),
      path: "/",
      maxAge: 1800,
    });
  }
  return res;
}
