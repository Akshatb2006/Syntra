import type { LighthouseSummary } from "@growth/shared/types";

interface Props {
  baseline: LighthouseSummary | null;
  after: LighthouseSummary | null;
}

function ScoreColumn({
  label,
  baseline,
  after,
}: {
  label: string;
  baseline: number | null;
  after: number | null;
}) {
  const delta = after !== null && baseline !== null ? after - baseline : null;
  const trendColor =
    delta === null
      ? "text-[var(--fg-muted)]"
      : delta > 0
        ? "text-emerald-400"
        : delta < 0
          ? "text-rose-400"
          : "text-[var(--fg-muted)]";
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-[var(--bg)] p-3">
      <div className="text-xs uppercase tracking-wider text-[var(--fg-muted)]">{label}</div>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-[var(--fg-muted)]">{baseline ?? "—"}</span>
        <span className="text-[var(--fg-muted)]">→</span>
        <span className="text-base font-semibold text-[var(--fg)]">{after ?? "—"}</span>
      </div>
      <div className={`text-xs font-medium ${trendColor}`}>
        {delta === null ? "" : delta > 0 ? `+${delta}` : `${delta}`}
      </div>
    </div>
  );
}

export function LighthouseDelta({ baseline, after }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <ScoreColumn
        label="Performance"
        baseline={baseline?.performance ?? null}
        after={after?.performance ?? null}
      />
      <ScoreColumn
        label="Accessibility"
        baseline={baseline?.accessibility ?? null}
        after={after?.accessibility ?? null}
      />
      <ScoreColumn
        label="Best Practices"
        baseline={baseline?.bestPractices ?? null}
        after={after?.bestPractices ?? null}
      />
      <ScoreColumn
        label="SEO"
        baseline={baseline?.seo ?? null}
        after={after?.seo ?? null}
      />
    </div>
  );
}
