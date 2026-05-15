import type { AgentStep } from "@growth/shared/types";
import { AGENTS } from "@growth/shared/constants";

function relative(start: number, end: number | null): string {
  const d = (end ?? Date.now()) - start;
  if (d < 1000) return `${d}ms`;
  if (d < 60_000) return `${(d / 1000).toFixed(1)}s`;
  return `${(d / 60_000).toFixed(1)}m`;
}

export function Timeline({ steps, compact, detailed }: { steps: AgentStep[], compact?: boolean, detailed?: boolean }) {
  if (steps.length === 0) {
    return <div className="text-sm text-[var(--fg-muted)]">No agent activity yet.</div>;
  }

  if (compact) {
    return (
      <div className="flex flex-col">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const statusMap = {
            completed: { markerClass: 'done', icon: '✓', titleClass: '', tag: '' },
            running: { markerClass: 'run ring-pulse', icon: '', titleClass: 'running', tag: 'running' },
            failed: { markerClass: 'failed', icon: '✕', titleClass: '', tag: '' },
            pending: { markerClass: 'pending', icon: '', titleClass: 'pending', tag: '' }
          };
          const status = statusMap[step.status as keyof typeof statusMap] || statusMap.pending;

          return (
            <div className="step" key={step.id}>
              <div className="step-rail">
                <div className={`step-marker ${status.markerClass}`}>{status.icon}</div>
                {!isLast && <div className="step-line"></div>}
              </div>
              <div className="step-body">
                <div className={`step-title ${status.titleClass}`}>
                  {AGENTS[step.agent]?.displayName ?? step.agent}
                  {status.tag && <span className="running-tag pulse-soft">{status.tag}</span>}
                </div>
                <div className="step-meta">{step.title}</div>
                <div className={`step-dur mono ${step.status === 'running' ? 'live' : ''}`}>
                  {relative(step.startedAt, step.endedAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {steps.map((step) => {
        const statusMap = {
          completed: { rowClass: '', markerClass: 'done', icon: '✓', tagClass: 'done', tagText: 'DONE' },
          running: { rowClass: 'live', markerClass: 'run ring-pulse', icon: '◆', tagClass: 'run pulse-soft', tagText: 'RUNNING' },
          failed: { rowClass: '', markerClass: 'failed', icon: '✕', tagClass: 'fail', tagText: 'FAILED' },
          pending: { rowClass: 'pending', markerClass: 'pending', icon: '○', tagClass: '', tagText: 'PENDING' }
        };
        const status = statusMap[step.status as keyof typeof statusMap] || statusMap.pending;

        return (
          <div className={`tl-row ${status.rowClass}`} key={step.id}>
            <div className={`tl-marker ${status.markerClass}`}>{status.icon}</div>
            <div className="min-w-0">
              <div className="tl-head">
                <span className="tl-name">{step.title}</span>
                <span className={`tag ${status.tagClass}`}>{status.tagText}</span>
              </div>
              <div className="tl-meta mono">
                {AGENTS[step.agent]?.displayName ?? step.agent} · started {new Date(step.startedAt).toLocaleTimeString()}
              </div>
              {step.error && (
                <div className="nested">
                  <div className="line"><span className="l" style={{ color: 'var(--danger)' }}>Error</span></div>
                  <div className="line"><span className="l">{step.error.message}</span></div>
                </div>
              )}
            </div>
            <div className={`tl-dur mono ${step.status === 'running' ? 'live' : ''}`}>
              {relative(step.startedAt, step.endedAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
