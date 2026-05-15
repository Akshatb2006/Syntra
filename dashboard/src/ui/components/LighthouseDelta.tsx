import type { LighthouseSummary } from "@growth/shared/types";

interface Props {
  baseline: LighthouseSummary | null;
  after: LighthouseSummary | null;
}

function scoreColor(score: number | null): string {
  if (score === null) return '#d4d4cc';
  if (score >= 90) return '#15803d';
  if (score >= 50) return '#b45309';
  return '#be123c';
}

function scoreDashArray(score: number | null): string {
  if (score === null) return '0 188.5';
  return `${(score / 100) * 188.5} 188.5`;
}

function GaugeChart({ score, label }: { score: number | null; label: string }) {
  return (
    <div className="lh-gauge">
      <svg viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="30" fill="none" stroke="#f4f4ef" strokeWidth="6" />
        <circle
          cx="36" cy="36" r="30" fill="none"
          stroke={scoreColor(score)}
          strokeWidth="6"
          strokeDasharray={scoreDashArray(score)}
          transform="rotate(-90 36 36)"
          strokeLinecap="round"
        />
        <text x="36" y="41" textAnchor="middle" fontSize="17" fontWeight="600" fill="#111114" fontFamily="JetBrains Mono">
          {score ?? '–'}
        </text>
      </svg>
      <div className="label">{label}</div>
    </div>
  );
}

function delta(base: number | null, after: number | null): string {
  if (base === null || after === null) return '';
  const d = after - base;
  if (d === 0) return '±0';
  return d > 0 ? `+${d}` : `${d}`;
}

function deltaColor(base: number | null, after: number | null): string {
  if (base === null || after === null) return 'var(--fg-muted)';
  const d = after - base;
  if (d > 0) return 'var(--success)';
  if (d < 0) return 'var(--danger)';
  return 'var(--fg-muted)';
}

export function LighthouseDelta({ baseline, after }: Props) {
  const categories = [
    { key: 'performance', label: 'Perf' },
    { key: 'accessibility', label: 'A11y' },
    { key: 'bestPractices', label: 'Best' },
    { key: 'seo', label: 'SEO' },
  ] as const;

  return (
    <div className="lh-grid">
      {/* Baseline card */}
      <div className="lh-card">
        <div className="lh-head">
          <div>
            <div className="lh-head-title">Baseline</div>
            <div className="lh-head-meta">production · captured at run start</div>
          </div>
          <span className="pill low">PROD</span>
        </div>
        <div className="lh-gauges">
          {categories.map(c => (
            <GaugeChart key={c.key} score={baseline?.[c.key] ?? null} label={c.label} />
          ))}
        </div>
        {!baseline && (
          <div className="lh-detail">
            <div className="row"><span className="pulse-soft" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}></span><span>Lighthouse audit pending…</span></div>
          </div>
        )}
      </div>

      <div className="lh-arrow">→</div>

      {/* After card */}
      <div className={`lh-card ${!after ? 'pending' : ''}`}>
        <div className="lh-head">
          <div>
            <div className={`lh-head-title ${!after ? 'muted' : ''}`}>After</div>
            <div className="lh-head-meta">preview deployment</div>
          </div>
          <span className={`pill ${after ? 'open' : 'pending pulse-soft'}`}>{after ? 'DONE' : 'PENDING'}</span>
        </div>
        <div className="lh-gauges">
          {categories.map(c => (
            <GaugeChart key={c.key} score={after?.[c.key] ?? null} label={c.label} />
          ))}
        </div>
        {baseline && after && (
          <div className="lh-detail">
            {categories.map(c => {
              const d = delta(baseline[c.key], after[c.key]);
              if (!d || d === '±0') return null;
              return (
                <div className="row" key={c.key}>
                  <span style={{ color: deltaColor(baseline[c.key], after[c.key]) }}>●</span>
                  <span>{c.label}: <strong style={{ color: deltaColor(baseline[c.key], after[c.key]) }}>{d}</strong></span>
                </div>
              );
            })}
          </div>
        )}
        {!after && (
          <div className="lh-detail">
            <div className="row"><span className="pulse-soft" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}></span><span>Awaiting preview deploy to re-run Lighthouse</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
