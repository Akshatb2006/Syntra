"use client";
import type { LighthouseSummary } from "@growth/shared/types";

function scoreColor(v: number): string {
  if (v >= 90) return "var(--success)";
  if (v >= 50) return "var(--warn)";
  return "var(--danger)";
}

function Score({ value, label, big }: { value: number; label: string; big?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: big ? 38 : 22,
          fontWeight: 700,
          lineHeight: 1,
          color: scoreColor(value),
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
        }}
      >
        {Math.round(value)}
      </div>
      <div style={{ fontSize: big ? 12 : 11, color: "var(--fg-dim)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

/**
 * The results-first header. Leads with the real, measured Search Health (the
 * site's baseline Lighthouse scores) and the count of opportunities found —
 * not agent logs. This is the first thing a user should see.
 */
export function SearchHealth({
  baseline,
  opportunities,
  analyzing,
}: {
  baseline: LighthouseSummary | null;
  opportunities: number;
  analyzing: boolean;
}) {
  if (!baseline) {
    return (
      <div className="sug-card" style={{ marginBottom: 18 }}>
        <div className="label" style={{ marginBottom: 6 }}>Search health</div>
        <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
          {analyzing ? "Measuring your site…" : "No baseline yet."}
        </div>
      </div>
    );
  }
  return (
    <div className="sug-card" style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        <div>
          <div className="label" style={{ marginBottom: 12 }}>Search health</div>
          <div style={{ display: "flex", gap: 26, alignItems: "flex-end" }}>
            <Score value={baseline.seo} label="SEO" big />
            <Score value={baseline.performance} label="Performance" />
            <Score value={baseline.accessibility} label="Accessibility" />
            <Score value={baseline.bestPractices} label="Best practices" />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: "var(--fg)" }}>
            {opportunities}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 4 }}>
            {analyzing && opportunities === 0 ? "analyzing…" : "opportunities found"}
          </div>
        </div>
      </div>
    </div>
  );
}
