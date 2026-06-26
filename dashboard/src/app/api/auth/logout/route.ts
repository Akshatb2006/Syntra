import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signOut() {
  const res = NextResponse.redirect(`${env.authUrl}/`);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

// POST is the real sign-out (form). GET is allowed so a plain link works too.
export async function POST() {
  return signOut();
}
export async function GET() {
  return signOut();
}
