import Link from "next/link";
import { redirect } from "next/navigation";
import { sqliteStore } from "@/infra/store/sqlite";
import { getSession } from "@/lib/auth/server";
import { RunStatusBadge } from "@/ui/components/StatusBadge";
import { LockedFeature } from "@/ui/components/LockedFeature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

export default async function RunsIndexPage() {
  const session = await getSession();
  if (!session) redirect("/");
  // Only this user's runs — never anyone else's.
  const runs = sqliteStore.runs.list(50, session.uid);
  return (
    <div className="page-shell">
      <div className="section-head">
        <div>
          <h1 className="section-title">Runs</h1>
          <p className="section-sub">
            Each run audits a site, plans fixes, opens a PR, and validates the
            preview deployment — autonomously.
          </p>
        </div>
        {/* Free trial: new runs aren't provisioned yet — send them to the dashboard. */}
        <Link href="/">
          <button className="btn btn-primary">+ New run</button>
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No runs yet</div>
          <div className="empty-desc">
            <LockedFeature label="Connect your credentials" variant="inline" align="left" />{" "}
            then{" "}
            <Link href="/">start your first autonomous run</Link>.
          </div>
        </div>
      ) : (
        <div className="run-list">
          {runs.map((run) => (
            <Link key={run.id} href={`/runs/${run.id}`} className="run-item">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="run-item-id">{run.id}</span>
                  <RunStatusBadge status={run.status} />
                </div>
                <div className="run-item-url">{run.input.siteUrl}</div>
                <div className="run-item-repo mono">
                  {run.input.repoUrl
                    ? run.input.repoUrl.replace("https://github.com/", "")
                    : "audit only"}
                </div>
              </div>
              <div className="run-item-meta">
                <div>{timeAgo(run.createdAt)}</div>
                {run.prUrl && (
                  <div style={{ color: "var(--success)", marginTop: 4 }}>
                    PR ready ↗
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
