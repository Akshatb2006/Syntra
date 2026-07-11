import { type NextRequest } from "next/server";
import { eventBus } from "@/infra/eventbus/local.bus";
import { ensureRuntime } from "@/orchestration/job-runner";
import { requireOwnedRun } from "@/lib/auth/guard";
import type { PlatformEvent } from "@growth/shared/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * SSE stream of platform events filtered to a single run. Events with a `runId`
 * field are filtered; events without runId (e.g. global webhook receipts) are
 * passed through too so the UI can show external triggers.
 */
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  // Don't stream another user's run events.
  const g = await requireOwnedRun(id);
  if (!g.ok) return g.res;
  ensureRuntime();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const write = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // already closed
        }
      };

      // Replay any recent events for this run (catch-up).
      for (const ev of eventBus.recent(200)) {
        if (matches(ev, id)) write(ev);
      }
      write({ type: "_hello", runId: id, at: Date.now() });

      const unsubscribe = eventBus.subscribe((ev) => {
        if (matches(ev, id)) write(ev);
      });

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // already closed
        }
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function matches(ev: PlatformEvent, runId: string): boolean {
  if (!("runId" in ev)) return false;
  return ev.runId === runId || ev.runId === null || ev.runId === "";
}
