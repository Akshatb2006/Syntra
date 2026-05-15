import { NextResponse } from "next/server";
import { sqliteStore } from "@/infra/store/sqlite";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VercelDeploymentDto {
  uid: string;
  url: string;
  state: string;
  target: string | null;
  meta?: { githubCommitRef?: string; githubPrId?: string };
  created: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = sqliteStore.runs.get(id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const creds = sqliteStore.secrets.get(run.credentialsRef);
  if (!creds?.vercelToken || !creds.vercelProjectId) {
    return NextResponse.json(
      { error: "Vercel credentials not configured" },
      { status: 412 },
    );
  }

  const url = new URL("https://api.vercel.com/v6/deployments");
  url.searchParams.set("projectId", creds.vercelProjectId);
  url.searchParams.set("limit", "1");
  if (creds.vercelTeamId) url.searchParams.set("teamId", creds.vercelTeamId);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${creds.vercelToken}` },
      // Vercel API state changes rapidly — never cache.
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("vercel_latest_deployment_failed", {
        status: res.status,
        body: body.slice(0, 300),
      });
      return NextResponse.json(
        { error: `Vercel API ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { deployments: VercelDeploymentDto[] };
    const latest = data.deployments[0];
    if (!latest) return NextResponse.json({ deployment: null });
    return NextResponse.json({
      deployment: {
        url: latest.url.startsWith("http") ? latest.url : `https://${latest.url}`,
        state: latest.state,
        target: latest.target,
        commitRef: latest.meta?.githubCommitRef ?? null,
        created: latest.created,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("vercel_latest_deployment_threw", { error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
