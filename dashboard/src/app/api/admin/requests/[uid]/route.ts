import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sqliteStore } from "@/infra/store/sqlite";
import { requireUser } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/admin";
import { sendAccessApprovedEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ uid: string }>;
}

const schema = z.object({ action: z.enum(["approve", "reject"]) });

/** Admin-only: approve or reject a user's alpha-access request. */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  if (!isAdmin(g.session.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { uid } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 422 });
  }

  const target = sqliteStore.users.get(uid);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const status = parsed.data.action === "approve" ? "approved" : "rejected";
  sqliteStore.users.setAccessStatus(uid, status);
  logger.info("access_status_changed", { uid, status, by: g.session.email });

  if (status === "approved") {
    // Best-effort — never blocks the approval.
    void sendAccessApprovedEmail(target.email, target.name, env.authUrl);
  }

  return NextResponse.json({ ok: true, status });
}
