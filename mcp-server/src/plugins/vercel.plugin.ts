import { z } from "zod";
import type { Plugin } from "./types.js";
import { MCP_TOOLS } from "@growth/shared/constants";
import type { VercelPreviewLookupOutput } from "@growth/shared/types";
import { logger } from "../lib/logger.js";

interface VercelDeploymentDto {
  uid: string;
  url: string;
  state: string;
  target: string | null;
  meta?: { githubCommitRef?: string; githubPrId?: string };
  created: number;
}

export const vercelPlugin: Plugin = {
  name: "vercel",
  register(server) {
    server.tool(
      MCP_TOOLS.VERCEL_PREVIEW_LOOKUP,
      "Find the Vercel preview deployment for a given PR or branch. Returns preview URL when ready.",
      {
        vercelToken: z.string().min(1),
        projectId: z.string().min(1),
        teamId: z.string().optional(),
        branch: z.string().min(1),
        commitSha: z.string().optional(),
        timeoutMs: z.number().int().positive().default(60_000),
      },
      async ({ vercelToken, projectId, teamId, branch, commitSha, timeoutMs }) => {
        const deadline = Date.now() + timeoutMs;
        const url = new URL("https://api.vercel.com/v6/deployments");
        url.searchParams.set("projectId", projectId);
        url.searchParams.set("target", "preview");
        url.searchParams.set("limit", "20");
        if (teamId) url.searchParams.set("teamId", teamId);

        let lastErr: string | null = null;
        while (Date.now() < deadline) {
          try {
            const res = await fetch(url.toString(), {
              headers: { Authorization: `Bearer ${vercelToken}` },
            });
            if (!res.ok) {
              lastErr = `Vercel API ${res.status}: ${await res.text()}`;
              break;
            }
            const data = (await res.json()) as {
              deployments: VercelDeploymentDto[];
            };
            const candidates = data.deployments.filter((d) => {
              const ref = d.meta?.githubCommitRef;
              if (commitSha) return d.uid.includes(commitSha) || ref === branch;
              return ref === branch;
            });
            const ready = candidates.find((d) => d.state === "READY");
            if (ready) {
              const out: VercelPreviewLookupOutput = {
                previewUrl: `https://${ready.url}`,
                status: "ready",
                deploymentId: ready.uid,
              };
              return {
                content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
              };
            }
            const building = candidates.find(
              (d) => d.state === "BUILDING" || d.state === "QUEUED",
            );
            if (building && Date.now() + 5000 < deadline) {
              await new Promise((r) => setTimeout(r, 5000));
              continue;
            }
            const errored = candidates.find(
              (d) => d.state === "ERROR" || d.state === "CANCELED",
            );
            const out: VercelPreviewLookupOutput = {
              previewUrl: null,
              status: errored
                ? "error"
                : building
                  ? "building"
                  : candidates[0]
                    ? "queued"
                    : "unknown",
              deploymentId: errored?.uid ?? building?.uid ?? null,
            };
            return {
              content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
            };
          } catch (err) {
            lastErr = err instanceof Error ? err.message : String(err);
            break;
          }
        }
        logger.warn("vercel_preview_lookup_failed", { branch, error: lastErr });
        return {
          content: [
            { type: "text", text: `Error: ${lastErr ?? "timed out"}` },
          ],
          isError: true,
        };
      },
    );
  },
};
