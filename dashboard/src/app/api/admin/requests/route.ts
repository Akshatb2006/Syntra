import { NextResponse } from "next/server";
import { sqliteStore } from "@/infra/store/sqlite";
import { requireUser } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin-only: all users who have submitted an alpha-access request. */
export async function GET() {
  const g = await requireUser();
  if (!g.ok) return g.res;
  if (!isAdmin(g.session.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const requests = sqliteStore.users.listAccessRequests().map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    company: u.company,
    website: u.website,
    industry: u.industry,
    teamSize: u.teamSize,
    useCase: u.useCase,
    accessStatus: u.accessStatus,
    requestedAt: u.requestedAt,
    accessUpdatedAt: u.accessUpdatedAt,
  }));
  return NextResponse.json({ requests });
}
