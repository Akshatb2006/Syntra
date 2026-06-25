import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Auth gate for PAGE routes. Unauthenticated → /login; authenticated but not
 * onboarded → /onboarding. API routes are skipped here on purpose — they enforce
 * auth themselves and must return JSON 401/404, not an HTML redirect.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass-through: API (self-guarded), Next internals, the login page itself.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/login"
  ) {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Onboarding is mandatory before the dashboard.
  if (!session.onb && pathname !== "/onboarding") {
    const url = req.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Don't let an onboarded user sit on the onboarding screen.
  if (session.onb && pathname === "/onboarding") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets; the body skips /api and /_next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
