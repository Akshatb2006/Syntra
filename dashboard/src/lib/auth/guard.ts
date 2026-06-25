/**
 * Authorization guards for API route handlers. `requireUser` enforces a signed-in
 * session; `requireOwnedRun` additionally enforces that the run belongs to that
 * user. A non-owner gets 404 (not 403) so run IDs can't be probed for existence.
 *
 * Usage:
 *   const g = await requireOwnedRun(id);
 *   if (!g.ok) return g.res;
 *   // g.run and g.session are now available and type-safe
 */
import { NextResponse } from "next/server";
import type { Run } from "@growth/shared/types";
import { sqliteStore } from "@/infra/store/sqlite";
import { getSession } from "./server";
import type { SessionPayload } from "./session";

type Ok<T> = { ok: true } & T;
type Denied = { ok: false; res: NextResponse };

export async function requireUser(): Promise<Ok<{ session: SessionPayload }> | Denied> {
  const session = await getSession();
  if (!session) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, session };
}

export async function requireOwnedRun(
  runId: string,
): Promise<Ok<{ session: SessionPayload; run: Run }> | Denied> {
  const session = await getSession();
  if (!session) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const run = sqliteStore.runs.get(runId);
  if (!run || run.owner !== session.uid) {
    // 404, not 403 — never confirm a run exists to someone who doesn't own it.
    return { ok: false, res: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { ok: true, session, run };
}
