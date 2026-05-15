"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import type {
  AgentStep,
  PlatformEvent,
  Run,
  Suggestion,
  TraceSpan,
} from "@growth/shared/types";
import { Card, CardHeader, CardBody } from "@/ui/components/Card";
import { Badge } from "@/ui/components/Badge";
import { RunStatusBadge } from "@/ui/components/StatusBadge";
import { Timeline } from "@/ui/components/Timeline";
import { TraceTree } from "@/ui/components/TraceTree";
import { LighthouseDelta } from "@/ui/components/LighthouseDelta";
import { SuggestionList } from "@/ui/components/SuggestionList";
import { DevelopDialog } from "@/ui/components/DevelopDialog";
import { useSse } from "@/ui/hooks/useSse";

interface DetailResponse {
  run: Run;
  steps: AgentStep[];
  traces: TraceSpan[];
  suggestions: Suggestion[];
}

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [developTarget, setDevelopTarget] = useState<Suggestion | null>(null);
  const { events, connected } = useSse<PlatformEvent>(`/api/runs/${id}/events`);

  async function refresh() {
    const r = await fetch(`/api/runs/${id}`);
    if (r.ok) setData((await r.json()) as DetailResponse);
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    // Whenever a meaningful event arrives, refresh aggregated state.
    if (events.length === 0) return;
    const last = events[events.length - 1];
    if (!last) return;
    if (
      last.type === "agent.step_started" ||
      last.type === "agent.step_finished" ||
      last.type === "run.status_changed" ||
      last.type === "suggestion.proposed" ||
      last.type === "suggestion.selected" ||
      last.type === "preview.ready" ||
      last.type === "run.completed" ||
      last.type === "run.failed"
    ) {
      void refresh();
    }
  }, [events.length]);

  if (!data) {
    return (
      <div className="text-sm text-[var(--fg-muted)]">Loading run {id}…</div>
    );
  }
  const { run, steps, traces, suggestions } = data;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/"
            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            ← Runs
          </Link>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">
            {run.input.siteUrl}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <span className="font-mono">{run.id}</span>
            <RunStatusBadge status={run.status} />
            <Badge tone={connected ? "accent" : "muted"}>
              {connected ? "live" : "disconnected"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-3">
          {run.prUrl && (
            <a
              href={run.prUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg)] hover:bg-[var(--bg-elev)]"
            >
              View PR ↗
            </a>
          )}
          {run.previewUrl && (
            <a
              href={run.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-emerald-900/50 bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-900/60"
            >
              View preview ↗
            </a>
          )}
        </div>
      </section>

      <Card>
        <CardHeader>Lighthouse</CardHeader>
        <CardBody>
          <LighthouseDelta
            baseline={run.baselineLighthouse}
            after={run.afterLighthouse}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>Agent timeline</CardHeader>
          <CardBody>
            <Timeline steps={steps} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Trace tree</CardHeader>
          <CardBody className="scrollbar-thin max-h-[480px] overflow-auto">
            <TraceTree spans={traces} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>Suggestions</CardHeader>
        <CardBody>
          <SuggestionList
            suggestions={suggestions}
            onDevelop={(s) => setDevelopTarget(s)}
          />
        </CardBody>
      </Card>

      <DevelopDialog
        runId={id}
        suggestion={developTarget}
        onClose={() => setDevelopTarget(null)}
        onDispatched={() => void refresh()}
      />

      {run.error && (
        <Card>
          <CardHeader>Error</CardHeader>
          <CardBody>
            <pre className="scrollbar-thin overflow-auto rounded-md bg-rose-950/30 p-3 text-xs text-rose-200">
              {run.error.message}
            </pre>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
