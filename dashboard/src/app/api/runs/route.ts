import { NextResponse, type NextRequest } from "next/server";
import { createRunRequestSchema } from "@growth/shared/schemas";
import { sqliteStore } from "@/infra/store/sqlite";
import { createRun } from "@/orchestration/pipeline";
import { ensureRuntime } from "@/orchestration/job-runner";
import { requireUser } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/admin";
import { isSuccessfulAudit } from "@/orchestration/run-status";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const g = await requireUser();
  if (!g.ok) return g.res;
  // Strictly the signed-in user's own runs.
  const runs = sqliteStore.runs.list(100, g.session.uid);
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const g = await requireUser();
  if (!g.ok) return g.res;

  // --- Alpha access gate ---
  // Only approved users (or admins) may run audits. Everyone else is asked to
  // request access. The client turns this 403 into the Request/Pending modal.
  if (!isAdmin(g.session.email)) {
    const me = sqliteStore.users.get(g.session.uid);
    if (!me || me.accessStatus !== "approved") {
      return NextResponse.json(
        {
          error: "Alpha access required.",
          code: "access_gate",
          accessStatus: me?.accessStatus ?? "pending",
          requested: !!me?.requestedAt,
        },
        { status: 403 },
      );
    }
  }

  // --- Per-user run cap (alpha cost control) ---
  // Count this account's SUCCESSFUL audits. An audit-only run's success terminal
  // is "awaiting_dispatch" (see run-status.ts) — NOT "completed" — so we key off
  // isSuccessfulAudit. Failed/cancelled and still-in-flight runs don't count, so
  // a genuine failure or a cancel doesn't burn quota and a run orphaned by a
  // redeploy can't permanently lock the user out. Exempt accounts
  // (RUN_LIMIT_EXEMPT_EMAILS) bypass the cap entirely.
  if (!isAdmin(g.session.email) && !env.runLimitExemptEmails.has(g.session.email.toLowerCase())) {
    const successfulRuns = sqliteStore.runs
      .list(1000, g.session.uid)
      .filter((r) => isSuccessfulAudit(r.status)).length;
    if (successfulRuns >= env.maxRunsPerUser) {
      logger.warn("run_limit_reached", {
        uid: g.session.uid,
        successfulRuns,
        limit: env.maxRunsPerUser,
      });
      return NextResponse.json(
        {
          error: `You've reached the ${env.maxRunsPerUser}-audit limit for this alpha. Each account can run ${env.maxRunsPerUser} successful audits.`,
        },
        { status: 429 },
      );
    }
  }

  ensureRuntime();
  try {
    const body = await req.json();
    const parsed = createRunRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }
    // Identity is server-authoritative: override whatever the client sent with
    // the session user, and stamp ownership so only they can read this run back.
    const input = {
      ...parsed.data.input,
      trigger: { ...parsed.data.input.trigger, userId: g.session.uid },
    };
    const run = await createRun(input, parsed.data.credentialsRef, g.session.uid);
    return NextResponse.json({ run }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("api_runs_post_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
