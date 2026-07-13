import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { googleConsentUrl } from "@/lib/auth/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kick off Google OAuth: set a CSRF `state` cookie and redirect to consent. */
export async function GET() {
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
  return res;
}
