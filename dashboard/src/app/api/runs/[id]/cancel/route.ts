import { NextResponse, type NextRequest } from "next/server";
import { sqliteStore } from "@/infra/store/sqlite";
import { eventBus } from "@/infra/eventbus/local.bus";
import { requireOwnedRun } from "@/lib/auth/guard";
import { requestCancel } from "@/orchestration/cancel";
import { isCancellable } from "@/orchestration/run-status";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * Cancel an in-flight run. Owner-only. Flags the run for cooperative
 * cancellation (the pipeline stops at its next phase boundary) and optimistically
 * marks it "cancelled" so the UI updates immediately.
 */
export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const g = await requireOwnedRun(id);
  if (!g.ok) return g.res;
  const { run } = g;

  if (!isCancellable(run.status)) {
    return NextResponse.json(
      { error: `Run is already ${run.status} — nothing to cancel.` },
      { status: 409 },
    );
  }

  requestCancel(run.id);
  sqliteStore.runs.patch(run.id, { status: "cancelled", completedAt: Date.now() });
  eventBus.publish({
    type: "run.status_changed",
    runId: run.id,
    status: "cancelled",
    at: Date.now(),
  });
  logger.info("run_cancel_requested", { runId: run.id, uid: g.session.uid });

  return NextResponse.json({ ok: true, status: "cancelled" });
}
