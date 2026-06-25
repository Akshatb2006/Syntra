"use client";
import type { AgentStep } from "@growth/shared/types";

interface UnderstandingSummary {
  mode?: "llm" | "deterministic";
  taxonomy?: string[];
  entities?: Array<{
    name: string;
    kind: string;
    mentions: number;
    pages: number;
    ownership?: "none" | "partial" | "owned";
    coverageDepth?: "thin" | "sufficient";
  }>;
  contentGaps?: Array<{
    entity: string;
    kind: string;
    mentions: number;
    pageCount: number;
    samplePages: string[];
    mode?: "create" | "promote" | "expand";
    ownerPage?: string;
    reason: string;
  }>;
}

interface CrawlStepOutput {
  pagesCrawled?: number;
  pageTypes?: Array<{ type: string; count: number }>;
  businessProfile?: { industry?: string; locationBased?: boolean };
  understanding?: UnderstandingSummary;
}

/**
 * Site Understanding — turns crawl depth into visible trust. Reads the crawl
 * agent's step output (pages crawled, business-aware page-type breakdown, the
 * entities the site talks about, and content gaps) and renders it up front. The
 * content-gap row is the strategic payload: "X mentioned across N pages, no
 * dedicated page" is the finding a human consultant surfaces.
 */
export function SiteUnderstanding({ steps }: { steps: AgentStep[] }) {
  const crawl = steps.find((s) => s.agent === "crawl_seo");
  const out = (crawl?.output ?? null) as CrawlStepOutput | null;
  if (!out || typeof out.pagesCrawled !== "number") return null;

  const profile = out.businessProfile;
  const pageTypes = (out.pageTypes ?? []).filter((p) => p.count > 0);
  const u = out.understanding ?? {};
  const entities = (u.entities ?? []).slice(0, 10);
  const gaps = u.contentGaps ?? [];

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
        {entities.length > 0 && (
          <Stat value={String((u.entities ?? []).length)} label="entities" />
        )}
        {gaps.length > 0 && (
          <Stat value={String(gaps.length)} label="content gaps" accent />
        )}
      </div>

      {pageTypes.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {pageTypes.map((p) => (
            <Chip key={p.type} label={p.type} count={p.count} />
          ))}
        </div>
      )}

      {entities.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="label-sm" style={{ marginBottom: 8 }}>
            Entities this site talks about
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {entities.map((e) => (
              <span
                key={e.name}
                title={`${e.kind} · ${e.mentions} mentions across ${e.pages} page${e.pages === 1 ? "" : "s"} · ${ownershipLabel(e.ownership, e.coverageDepth)}`}
                style={{
                  fontSize: 12,
                  padding: "4px 11px",
                  borderRadius: 999,
                  background: "var(--bg, #fafaf7)",
                  border: "1px solid var(--border)",
                  color: "var(--fg)",
                  opacity: e.ownership === "none" ? 0.92 : 1,
                }}
              >
                {e.name}{" "}
                <strong style={{ color: "var(--fg-muted)", fontWeight: 500 }}>
                  ×{e.mentions}
                </strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {gaps.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="label-sm" style={{ marginBottom: 8 }}>
            Content gaps · create / promote / expand
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gaps.map((g) => (
              <div
                key={g.entity}
                style={{
                  fontSize: 12.5,
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "var(--bg, #fafaf7)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <ModeBadge mode={g.mode ?? "create"} />
                <strong style={{ color: "var(--fg)" }}>{g.entity}</strong>
                <span style={{ color: "var(--fg-dim)", fontSize: 11 }}>{g.kind}</span>
                <span style={{ color: "var(--fg-muted)", marginLeft: "auto" }}>
                  {g.mentions}× / {g.pageCount} page{g.pageCount === 1 ? "" : "s"} · {gapAction(g.mode, g.ownerPage)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ownershipLabel(
  ownership?: "none" | "partial" | "owned",
  depth?: "thin" | "sufficient",
): string {
  if (ownership === "owned")
    return depth === "thin" ? "owns it, but coverage is thin" : "has a dedicated page";
  if (ownership === "partial") return "referenced, but no page owns it";
  return "no dedicated page";
}

function gapAction(mode?: "create" | "promote" | "expand", ownerPage?: string): string {
  if (mode === "promote") return ownerPage ? `promote ${ownerPage}` : "promote existing page";
  if (mode === "expand") return ownerPage ? `expand ${ownerPage}` : "expand existing page";
  return "no dedicated page";
}

function ModeBadge({ mode }: { mode: "create" | "promote" | "expand" }) {
  const palette: Record<typeof mode, { fg: string; bg: string }> = {
    create: { fg: "#1b7f4b", bg: "rgba(27,127,75,0.12)" },
    promote: { fg: "#b06a00", bg: "rgba(176,106,0,0.12)" },
    expand: { fg: "#2563c9", bg: "rgba(37,99,201,0.12)" },
  };
  const c = palette[mode];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 5,
        color: c.fg,
        background: c.bg,
      }}
    >
      {mode}
    </span>
  );
}

function Chip({ label, count }: { label: string; count: number }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 11px",
        borderRadius: 999,
        background: "var(--bg, #fafaf7)",
        border: "1px solid var(--border)",
        color: "var(--fg-muted)",
      }}
    >
      {label} <strong style={{ color: "var(--fg)" }}>{count}</strong>
    </span>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: accent ? "var(--accent-strong, var(--fg))" : "var(--fg)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-dim)", marginTop: 3 }}>{label}</div>
    </div>
  );
}
