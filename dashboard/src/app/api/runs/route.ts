import { NextResponse, type NextRequest } from "next/server";
import { createRunRequestSchema } from "@growth/shared/schemas";
import { sqliteStore } from "@/infra/store/sqlite";
import { createRun } from "@/orchestration/pipeline";
import { ensureRuntime } from "@/orchestration/job-runner";
import { requireUser } from "@/lib/auth/guard";
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
