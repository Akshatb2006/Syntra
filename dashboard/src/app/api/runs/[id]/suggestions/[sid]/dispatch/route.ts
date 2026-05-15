import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sqliteStore } from "@/infra/store/sqlite";
import { eventBus } from "@/infra/eventbus/local.bus";
import { getTracer } from "@/infra/tracer";
import { getMcp } from "@/infra/mcp/http.client";
import { AnthropicClient } from "@/infra/llm/anthropic.client";
import { CodeModAgent } from "@/agents/code-mod.agent";
import { parseRepoFullName } from "@/orchestration/pipeline";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 900;

const bodySchema = z.object({
  prompt: z.string().optional(),
});

interface RouteCtx {
  params: Promise<{ id: string; sid: string }>;
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id: runId, sid: suggestionId } = await ctx.params;
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const run = sqliteStore.runs.get(runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const suggestion = sqliteStore.suggestions
      .byRun(runId)
      .find((s) => s.id === suggestionId);
    if (!suggestion)
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

    if (suggestion.status === "dispatched") {
      return NextResponse.json(
        { error: "Suggestion is already being dispatched" },
        { status: 409 },
      );
    }

    const creds = sqliteStore.secrets.get(run.credentialsRef);
    if (!creds)
      return NextResponse.json(
        { error: "Credentials no longer available — reconnect via /connect and start a new run" },
        { status: 400 },
      );

    const repoFullName = parseRepoFullName(run.input.repoUrl);
    const tracer = getTracer();
    const mcp = getMcp();
    const llm = new AnthropicClient();

    // Mark suggestion as dispatched immediately so the UI flips state on click.
    sqliteStore.suggestions.update(suggestion.id, { status: "dispatched" });
    eventBus.publish({
      type: "suggestion.selected",
      runId,
      suggestionId,
    });

    // Fire-and-forget the agent. UI tracks progress via SSE + suggestion status polling.
    void new CodeModAgent(mcp)
      .run(
        {
          runId,
          parentSpan: null,
          tracer,
          store: sqliteStore,
          events: eventBus,
          llm,
        },
        {
          workspaceId: run.workspaceId,
          repoFullName,
          baseBranch: run.input.branchBase ?? "main",
          githubToken: creds.githubToken,
          suggestion,
          userPrompt: parsed.data.prompt,
        },
      )
      .catch((err) => {
        logger.error("dispatch_unhandled", {
          runId,
          suggestionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return NextResponse.json(
      { status: "dispatched", runId, suggestionId },
      { status: 202 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("dispatch_route_error", { runId, suggestionId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
