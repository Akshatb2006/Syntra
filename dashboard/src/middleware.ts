import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Auth gate for PAGE routes. The landing (`/`) is fully public — signed-out
 * visitors can browse it freely and only hit sign-in when they click Analyze
 * (the hero form redirects to /api/auth/login carrying their URL). Every other
 * page requires a session and bounces signed-out visitors back to `/`.
 * Authenticated-but-not-onboarded → /onboarding. API routes are skipped here on
 * purpose — they enforce auth themselves and must return JSON 401/404, not an
 * HTML redirect.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass-through: API (self-guarded), Next internals, and any static asset in
  // /public (anything with a file extension — logo, icons, fonts, etc.).
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    // The gated dashboard is the only page a signed-out visitor may see.
    if (pathname === "/") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // The standalone sign-in page is retired; auth lives on the dashboard overlay.
  if (pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
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

  // Free trial: credential-connect and manual run-creation aren't provisioned
  // yet. Their UI entry points are locked; block direct URL access too.
  if (pathname === "/connect" || pathname === "/runs/new") {
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
