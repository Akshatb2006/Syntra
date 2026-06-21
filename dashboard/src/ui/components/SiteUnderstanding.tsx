"use client";
import type { AgentStep } from "@growth/shared/types";

interface CrawlStepOutput {
  pagesCrawled?: number;
  pageTypes?: Array<{ type: string; count: number }>;
  businessProfile?: { industry?: string; locationBased?: boolean };
}

/**
 * Site Understanding — turns crawl depth into visible trust. Reads the crawl
 * agent's step output (pages crawled, page-type breakdown, detected business)
 * and renders it up front. When a user sees "27 pages crawled" instead of "1",
 * they trust the recommendations that follow.
 */
export function SiteUnderstanding({ steps }: { steps: AgentStep[] }) {
  const crawl = steps.find((s) => s.agent === "crawl_seo");
  const out = (crawl?.output ?? null) as CrawlStepOutput | null;
  if (!out || typeof out.pagesCrawled !== "number") return null;

  const profile = out.businessProfile;
  const pageTypes = (out.pageTypes ?? []).filter((p) => p.count > 0);

  return (
    <div className="sug-card" style={{ marginBottom: 18 }}>
      <div className="label" style={{ marginBottom: 14 }}>Site understanding</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 26, alignItems: "flex-start" }}>
        <Stat value={`✓ ${out.pagesCrawled}`} label="pages crawled" />
        {profile?.industry && <Stat value={profile.industry} label="detected industry" />}
        {profile && (
          <Stat value={profile.locationBased ? "Local" : "Global"} label="business type" />
        )}
        {pageTypes.length > 0 && (
          <Stat value={String(pageTypes.length)} label="page types" />
        )}
      </div>
      {pageTypes.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {pageTypes.map((p) => (
            <span
              key={p.type}
              style={{
                fontSize: 12,
                padding: "4px 11px",
                borderRadius: 999,
                background: "var(--bg, #fafaf7)",
                border: "1px solid var(--border)",
                color: "var(--fg-muted)",
              }}
            >
              {p.type} <strong style={{ color: "var(--fg)" }}>{p.count}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--fg)", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-dim)", marginTop: 3 }}>{label}</div>
    </div>
  );
}
