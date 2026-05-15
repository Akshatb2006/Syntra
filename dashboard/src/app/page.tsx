import Link from "next/link";
import { sqliteStore } from "@/infra/store/sqlite";
import { Card, CardBody } from "@/ui/components/Card";
import { Button } from "@/ui/components/Button";
import { RunStatusBadge } from "@/ui/components/StatusBadge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

export default function HomePage() {
  const runs = sqliteStore.runs.list(50);
  return (
    <div className="space-y-8">
      <section className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Each run audits a site, plans fixes, opens a PR, and validates the
            preview deployment — autonomously.
          </p>
        </div>
        <Link href="/runs/new">
          <Button>+ New run</Button>
        </Link>
      </section>

      {runs.length === 0 ? (
        <Card>
          <CardBody className="text-center text-sm text-[var(--fg-muted)]">
            No runs yet.{" "}
            <Link href="/connect" className="text-[var(--accent)] hover:underline">
              Connect your credentials
            </Link>{" "}
            and{" "}
            <Link
              href="/runs/new"
              className="text-[var(--accent)] hover:underline"
            >
              start the first run
            </Link>
            .
          </CardBody>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/runs/${run.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--bg)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[var(--fg-muted)]">
                        {run.id}
                      </span>
                      <RunStatusBadge status={run.status} />
                    </div>
                    <div className="mt-1 truncate text-sm text-[var(--fg)]">
                      {run.input.siteUrl}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">
                      {run.input.repoUrl}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-[var(--fg-muted)]">
                    <div>{timeAgo(run.createdAt)}</div>
                    {run.prUrl && (
                      <div className="text-emerald-400">PR ready</div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
