import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sqliteStore } from "@/infra/store/sqlite";
import { requireUser } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  company: z.string().trim().min(1).max(200),
  website: z.string().trim().min(1).max(300),
  industry: z.string().trim().min(1).max(120),
  teamSize: z.string().trim().min(1).max(60),
  useCase: z.string().trim().min(1).max(2000),
});

/**
 * Submit an alpha-access request. Stores the customer-discovery answers on the
 * user and stamps requestedAt. Status stays `pending` until an admin approves.
 */
export async function POST(req: NextRequest) {
  const g = await requireUser();
  if (!g.ok) return g.res;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fill in every field.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  sqliteStore.users.setAccessRequest(g.session.uid, parsed.data);
  logger.info("access_requested", {
    uid: g.session.uid,
    email: g.session.email,
    company: parsed.data.company,
  });

  return NextResponse.json({ ok: true, status: "pending" });
}
