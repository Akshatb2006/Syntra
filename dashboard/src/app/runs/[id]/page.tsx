"use client";
import { use, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type {
  AgentStep,
  PlatformEvent,
  Run,
  Suggestion,
  TraceSpan,
} from "@growth/shared/types";
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

function eventTime(event: PlatformEvent): number {
  if ("at" in event) return event.at;
  if (event.type === "trace.span_started") return event.span.startTime;
  if (event.type === "trace.span_finished") return event.endTime;
  return Date.now();
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
  const [activeTab, setActiveTab] = useState("timeline");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, string> = { '1': 'timeline', '2': 'trace', '3': 'suggestions', '4': 'lighthouse', '5': 'pr' };
      if (map[e.key]) setActiveTab(map[e.key]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!data) {
    return <div className="text-sm text-[var(--fg-muted)] p-8">Loading run {id}…</div>;
  }
  const { run, steps, traces, suggestions } = data;
  const isActiveRun =
    run.status !== "completed" &&
    run.status !== "failed" &&
    run.status !== "cancelled";

  let hostname = "site";
  let repo = "repo";
  try {
    hostname = new URL(run.input.siteUrl).hostname;
    repo = run.input.repoUrl.replace("https://github.com/", "");
  } catch {}

  const portalTarget = mounted ? document.getElementById("header-portal-target") : null;

  return (
    <>
      {portalTarget && createPortal(
        <>
          <div className="run-id-chip">
            <span className={`dot ${isActiveRun ? 'pulse-soft' : ''}`}></span>
            <span className="mono" style={{ fontSize: '0.75rem' }}>{run.id}</span>
          </div>
          <div className="breadcrumbs hidden sm:flex">
            <span className="site">{hostname}</span>
            <span className="sep">/</span>
            <span className="mono meta">{repo}</span>
            <span className="sep">/</span>
            <span className="meta">Run</span>
          </div>
          <div style={{ flex: 1 }}></div>
          {!connected && (
            <div className="recon-chip show">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warn)' }} className="pulse-soft"></span>
              reconnecting…
            </div>
          )}
          <div className={`status-pill ${run.status === 'completed' ? 'done' : run.status === 'failed' ? 'failed' : ''}`}>
            <span className="dot pulse-soft"></span>
            <span>{run.status}</span>
          </div>
          {run.prUrl && <a className="header-link primary" href={run.prUrl} target="_blank" rel="noreferrer">PR <span className="ext">↗</span></a>}
          {run.previewUrl && <a className="header-link" href={run.previewUrl} target="_blank" rel="noreferrer">Preview <span className="ext">↗</span></a>}
        </>,
        portalTarget
      )}

      <div className="body-grid">
        <aside className="left">
          <div className="label">Pipeline</div>
          {/* We reuse Timeline for the left pane summary, we will adapt Timeline.tsx to render the step-rail */}
          <Timeline steps={steps} compact />
          
          <div className="group">
            <div className="label">Suggestions</div>
            <div className="kv">
              <span className="k">Proposed</span><span className="v mono">{suggestions.length}</span>
              <span className="k">Dispatched</span><span className="v mono accent">{suggestions.filter(s => s.status === 'dispatched' || s.status === 'implemented').length}</span>
              <span className="k">Validated</span><span className="v mono success">{suggestions.filter(s => s.status === 'implemented').length}</span>
            </div>
          </div>
          
          {run.error && (
            <div className="group">
              <div className="label" style={{ color: 'var(--danger)' }}>Error</div>
              <div style={{ fontSize: 11, color: 'var(--danger)', background: 'var(--danger-soft)', padding: '8px 10px', borderRadius: 6, marginTop: 8 }}>
                {run.error.message}
              </div>
            </div>
          )}
        </aside>

        <main className="center">
          <div className="tabs" role="tablist">
            <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>Timeline <span className="count">{steps.length}</span> <span className="key">1</span></button>
            <button className={`tab ${activeTab === 'trace' ? 'active' : ''}`} onClick={() => setActiveTab('trace')}>Trace <span className="count">{traces.length}</span> <span className="key">2</span></button>
            <button className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`} onClick={() => setActiveTab('suggestions')}>Suggestions <span className="count">{suggestions.length}</span> <span className="key">3</span></button>
            <button className={`tab ${activeTab === 'lighthouse' ? 'active' : ''}`} onClick={() => setActiveTab('lighthouse')}>Lighthouse <span className="key">4</span></button>
          </div>
          <div className="center-scroll">
             <section className={`pane ${activeTab === 'timeline' ? 'active' : ''}`}>
                <div className="pane-header">
                  <div>
                    <div className="pane-title">Agent steps</div>
                    <div className="pane-sub">{steps.length} steps recorded</div>
                  </div>
                </div>
                <Timeline steps={steps} detailed />
             </section>
             <section className={`pane ${activeTab === 'trace' ? 'active' : ''}`}>
                <TraceTree spans={traces} />
             </section>
             <section className={`pane ${activeTab === 'suggestions' ? 'active' : ''}`}>
                <SuggestionList suggestions={suggestions} onDevelop={(s) => setDevelopTarget(s)} />
             </section>
             <section className={`pane ${activeTab === 'lighthouse' ? 'active' : ''}`}>
                <LighthouseDelta baseline={run.baselineLighthouse} after={run.afterLighthouse} />
             </section>
          </div>
        </main>

        <aside className="right" style={{ position: 'relative' }}>
          <div className="log-head">
            <div className="log-head-row">
              <span className="log-head-title">Live log</span>
              <span className="log-streaming"><span className="dot pulse-soft"></span>streaming</span>
            </div>
            <div className="log-filters">
              <button className="log-filter active">All</button>
            </div>
          </div>
          <div className="log-feed" id="logFeed">
             {events.map((e, i) => {
               const ts = 'at' in e ? new Date((e as { at: number }).at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : '--:--:--';
               const [ns, eventName] = e.type.split('.');
               const level = e.type.includes('failed') || e.type.includes('error') ? 'error' : 'info';
               return (
                 <div key={i} className={`log-line new ${level === 'error' ? 'error' : ''}`}>
                   <span className="ts">{ts}</span>
                   <span className="lv">{level}</span>
                   <span className="msg"><span className="agent-tag">[{ns}]</span> {eventName}</span>
                 </div>
               );
             })}
          </div>
          <div className="log-foot">
            <span className="info">{events.length} lines · live</span>
          </div>
        </aside>
      </div>

      <DevelopDialog
        runId={id}
        suggestion={developTarget}
        onClose={() => setDevelopTarget(null)}
        onDispatched={() => void refresh()}
      />
    </>
  );
}
