import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sqliteStore } from "@/infra/store/sqlite";
import { eventBus } from "@/infra/eventbus/local.bus";
import { getTracer } from "@/infra/tracer";
import { getMcp } from "@/infra/mcp/http.client";
import { AnthropicClient } from "@/infra/llm/anthropic.client";
import { CodeModAgent } from "@/agents/code-mod.agent";
import { parseRepoFullName } from "@/orchestration/pipeline";
import { executionUnlocked } from "@/lib/plan";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 900;

const bodySchema = z.object({
  prompt: z.string().optional(),
  // Supplied on the FIRST implement of an audit-only run, when the user
  // connects GitHub. Ignored once the run already has a repo + credentials.
  repoUrl: z.string().url().optional(),
  credentialsRef: z.string().min(1).optional(),
});

interface RouteCtx {
  params: Promise<{ id: string; sid: string }>;
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { id: runId, sid: suggestionId } = await ctx.params;
  try {
    // Entitlement gate: the audit is free, execution is paid. Enforced here so
    // the lock can't be bypassed from the client.
    if (!executionUnlocked()) {
      return NextResponse.json(
        {
          error: "Generating pull requests is available on paid plans.",
          locked: true,
        },
        { status: 402 },
      );
    }

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

    // Resolve repo + credentials: either the run already has them, or the user
    // is connecting GitHub right now (first implement of an audit-only run).
    const credentialsRef = run.credentialsRef || parsed.data.credentialsRef;
    const repoUrl = run.input.repoUrl ?? parsed.data.repoUrl;
    if (!credentialsRef || !repoUrl) {
      return NextResponse.json(
        { error: "Connect a GitHub repo to implement this fix.", needsConnect: true },
        { status: 400 },
      );
    }

    const creds = sqliteStore.secrets.get(credentialsRef);
    if (!creds)
      return NextResponse.json(
        { error: "Credentials no longer available — reconnect to implement this fix." },
        { status: 400 },
      );

    // Persist the repo + creds onto the run the first time, so subsequent
    // fixes on this run don't re-ask.
    if (!run.credentialsRef || !run.input.repoUrl) {
      sqliteStore.runs.attachRepo(runId, { repoUrl, credentialsRef });
    }

    const repoFullName = parseRepoFullName(repoUrl);
    const tracer = getTracer();
    const mcp = getMcp();
    const llm = new AnthropicClient();

    // Ensure the repo is cloned into the workspace (idempotent — only the first
    // implement on this run actually clones). The audit ran without it.
    const cloneSpan = tracer.startSpan({
      name: "mcp.repo_clone",
      kind: "mcp_request",
      runId,
      parentSpanId: null,
      attributes: { repoUrl },
    });
    try {
      await mcp.repoClone(
        {
          workspaceId: run.workspaceId,
          repoUrl,
          githubToken: creds.githubToken,
          branchBase: run.input.branchBase ?? "main",
        },
        { traceId: cloneSpan.traceId, parentSpanId: cloneSpan.spanId },
      );
      cloneSpan.end({ status: "ok" });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      cloneSpan.end({ status: "error", error: e });
      return NextResponse.json(
        { error: `Could not access the repo: ${e.message}` },
        { status: 400 },
      );
    }

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
