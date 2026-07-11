import { NextResponse, type NextRequest } from "next/server";
import { sqliteStore } from "@/infra/store/sqlite";
import { requireOwnedRun } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const g = await requireOwnedRun(id);
  if (!g.ok) return g.res;
  const { run } = g;
  const steps = sqliteStore.steps.byRun(id);
  const traces = sqliteStore.traces.byRun(id);
  const suggestions = sqliteStore.suggestions.byRun(id);
  return NextResponse.json({ run, steps, traces, suggestions });
}
