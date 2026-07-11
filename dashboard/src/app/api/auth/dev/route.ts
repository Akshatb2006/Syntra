import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { sqliteStore } from "@/infra/store/sqlite";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dev-only login bypass (no Google). Enabled only when DEV_LOGIN=1. Lets us test
 * the full gated flow and per-user isolation locally before Google creds exist:
 *   /api/auth/dev?email=a@test.com   → signs in as that user
 * MUST stay disabled in production.
 */
export async function GET(req: NextRequest) {
  if (!env.devLogin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") ?? "dev@syntra.local").toLowerCase();
  const name = url.searchParams.get("name") ?? "Dev User";
  const user = sqliteStore.users.upsertByEmail({ email, name, image: null });
  const token = await signSession({
    uid: user.id,
    email: user.email,
    name: user.name,
    onb: user.onboarded,
  });
  const dest = user.onboarded ? `${env.authUrl}/` : `${env.authUrl}/onboarding`;
  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(env.authUrl.startsWith("https")));
  return res;
}
