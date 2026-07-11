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
import { SiteUnderstanding } from "@/ui/components/SiteUnderstanding";
import { SearchHealth } from "@/ui/components/SearchHealth";
import { executionUnlocked } from "@/lib/plan";
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
  const [activeTab, setActiveTab] = useState("results");
  const [mounted, setMounted] = useState(false);
  // While true, every suggestion renders expanded and the layout collapses to a
  // clean single column so window.print() produces a full-detail PDF that mirrors
  // the on-screen cards exactly.
  const [printing, setPrinting] = useState(false);
  const [latestDeployment, setLatestDeployment] = useState<{
    url: string;
    state: string;
    target: string | null;
    commitRef: string | null;
    created: number;
  } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Print orchestration. We can't rely on CSS alone to reveal collapsed card
  // detail (it isn't in the DOM until a card is open), so entering "print mode"
  // forces the Results tab + expands every card, waits for React to paint, then
  // opens the browser print dialog. `afterprint` restores the interactive view.
  function downloadPdf() {
    setActiveTab("results");
    setPrinting(true);
  }

  useEffect(() => {
    if (!printing) return;
    const restore = () => setPrinting(false);
    window.addEventListener("afterprint", restore);
    // Two frames so the expanded cards + print layout are painted before print.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => window.print()),
    );
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", restore);
    };
  }, [printing]);

  async function refresh() {
    const r = await fetch(`/api/runs/${id}`);
    if (r.ok) setData((await r.json()) as DetailResponse);
  }

  async function refreshDeployment() {
    try {
      const r = await fetch(`/api/runs/${id}/latest-deployment`);
      if (!r.ok) return; // 412 (no creds) / 502 (vercel down) — silently hide the chip
      const j = (await r.json()) as {
        deployment: typeof latestDeployment;
      };
      setLatestDeployment(j.deployment);
    } catch {
      // network blip — keep previous value
    }
  }

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    void refreshDeployment();
    const t = setInterval(refreshDeployment, 15000);
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
      const map: Record<string, string> = { '1': 'results', '2': 'timeline', '3': 'trace', '4': 'lighthouse' };
      if (map[e.key]) setActiveTab(map[e.key]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!data) {
    return <div className="text-sm text-[var(--fg-muted)] p-8">Loading run {id}…</div>;
  }
  const { run, steps, traces, suggestions } = data;
  const executionLocked = !executionUnlocked();
  const isActiveRun =
    run.status !== "completed" &&
    run.status !== "failed" &&
    run.status !== "cancelled";

  let hostname = "site";
  let repo = "repo";
  try {
    hostname = new URL(run.input.siteUrl).hostname;
    repo = run.input.repoUrl
      ? run.input.repoUrl.replace("https://github.com/", "")
      : "audit only";
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
          {suggestions.length > 0 && (
            <button
              className="header-link no-print"
              onClick={downloadPdf}
              title="Download a full-detail PDF of every suggestion, matching this view"
            >
              Download PDF <span className="ext">↓</span>
            </button>
          )}
          {run.prUrl && <a className="header-link primary" href={run.prUrl} target="_blank" rel="noreferrer">PR <span className="ext">↗</span></a>}
          {latestDeployment && (
            <a
              className="header-link"
              href={latestDeployment.url}
              target="_blank"
              rel="noreferrer"
              title={`${latestDeployment.state}${latestDeployment.target ? ` · ${latestDeployment.target}` : ""}${latestDeployment.commitRef ? ` · ${latestDeployment.commitRef}` : ""}`}
            >
              Latest deploy <span className="ext">↗</span>
            </a>
          )}
          {run.previewUrl && <a className="header-link" href={run.previewUrl} target="_blank" rel="noreferrer">Preview <span className="ext">↗</span></a>}
        </>,
        portalTarget
      )}

      <div className={`body-grid${printing ? " printing" : ""}`}>
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

          <div className="group">
            <div className="label" title="What Syntra believed when this run executed. Findings reflect these versions, not today's rules.">Version</div>
            <div className="kv">
              <span className="k">Engine</span><span className="v mono">{run.engineVersion}</span>
              <span className="k">Detector</span><span className="v mono">{run.detectorVersion}</span>
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
            <button className={`tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Results <span className="count">{suggestions.length}</span> <span className="key">1</span></button>
            <span style={{ alignSelf: 'center', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-dim)', padding: '0 12px 0 6px' }}>Advanced</span>
            <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>Timeline <span className="count">{steps.length}</span> <span className="key">2</span></button>
            <button className={`tab ${activeTab === 'trace' ? 'active' : ''}`} onClick={() => setActiveTab('trace')}>Trace <span className="count">{traces.length}</span> <span className="key">3</span></button>
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
             <section className={`pane ${activeTab === 'results' ? 'active' : ''}`}>
                {/* Print-only cover header — gives the exported PDF a titled,
                    branded top instead of a bare card list. Hidden on screen. */}
                <div className="print-report-head print-only">
                  <div className="print-report-brand">
                    <img src="/syntra-logo.png" alt="Syntra" />
                    <span>Syntra</span>
                  </div>
                  <h1>SEO Growth Report</h1>
                  <div className="print-report-meta">
                    <span>{hostname}</span>
                    <span>·</span>
                    <span className="mono">{run.id}</span>
                    <span>·</span>
                    <span>{suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>{new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
                  </div>
                </div>
                <SearchHealth
                  baseline={run.baselineLighthouse}
                  opportunities={suggestions.length}
                  analyzing={isActiveRun}
                />
                <SiteUnderstanding steps={steps} />
                {executionLocked && suggestions.length > 0 && (
                  <div style={{
                    background: 'var(--accent-soft, #ecfdf5)',
                    border: '1px solid #bbf7d0',
                    borderRadius: 10,
                    padding: '12px 16px',
                    margin: '0 0 18px',
                    fontSize: 13,
                    color: 'var(--fg-muted)',
                    lineHeight: 1.5,
                  }}>
                    <strong style={{ color: 'var(--fg)' }}>Under development</strong> — every
                    finding and recommendation below is yours. Automatic pull-request generation
                    is currently under development and will be available soon.
                  </div>
                )}
                <SuggestionList suggestions={suggestions} onDevelop={(s) => setDevelopTarget(s)} forceExpanded={printing} />
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
        suggestion={developTarget}
        onClose={() => setDevelopTarget(null)}
      />
    </>
  );
}
