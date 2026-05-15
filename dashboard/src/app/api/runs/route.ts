import { NextResponse, type NextRequest } from "next/server";
import { createRunRequestSchema } from "@growth/shared/schemas";
import { sqliteStore } from "@/infra/store/sqlite";
import { createRun } from "@/orchestration/pipeline";
import { ensureRuntime } from "@/orchestration/job-runner";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const runs = sqliteStore.runs.list(100);
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
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
    const run = await createRun(parsed.data.input, parsed.data.credentialsRef);
    return NextResponse.json({ run }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("api_runs_post_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
