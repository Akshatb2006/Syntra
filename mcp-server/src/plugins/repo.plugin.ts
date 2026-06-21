import { z } from "zod";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import { workspaceManager } from "../workspace/manager.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import type { Plugin } from "./types.js";
import { MCP_TOOLS } from "@growth/shared/constants";

function authedRepoUrl(repoUrl: string, token: string): string {
  // Inject token into HTTPS GitHub URLs for clone/push without storing creds.
  const url = new URL(repoUrl);
  if (url.hostname === "github.com" || url.hostname.endsWith(".github.com")) {
    url.username = "x-access-token";
    url.password = token;
  }
  return url.toString();
}

function git(workspaceId: string): SimpleGit {
  const repoPath = workspaceManager.repoPath(workspaceId);
  return simpleGit(repoPath);
}

export const repoPlugin: Plugin = {
  name: "repo",
  register(server) {
    server.tool(
      MCP_TOOLS.REPO_CLONE,
      "Clone a GitHub repository into a per-run workspace. Returns repoPath and default branch.",
      {
        workspaceId: z.string().min(6),
        repoUrl: z.string().url(),
        githubToken: z.string().min(1),
        branchBase: z.string().default("main"),
      },
      async ({ workspaceId, repoUrl, githubToken, branchBase }) => {
        try {
          const wsPath = workspaceManager.ensure(workspaceId);
          const repoPath = workspaceManager.repoPath(workspaceId);
          mkdirSync(wsPath, { recursive: true });
          const cloneUrl = authedRepoUrl(repoUrl, githubToken);
          // Idempotent: an audit-only run may implement several fixes, each of
          // which ensures the repo is present. Only clone if it isn't already.
          const alreadyCloned = existsSync(join(repoPath, ".git"));
          if (!alreadyCloned) {
            const cloner = simpleGit();
            await cloner.clone(cloneUrl, repoPath, ["--depth", "50"]);
          }
          const g = git(workspaceId);
          await g.addConfig("user.name", "Growth Engineer Bot");
          await g.addConfig("user.email", "bot@growth-engineer.local");
          const headCommit = (await g.revparse(["HEAD"])).trim();
          const defaultBranch = (await g.revparse(["--abbrev-ref", "HEAD"])).trim();
          await g.fetch("origin", branchBase);
          logger.info(alreadyCloned ? "repo_reused" : "repo_cloned", {
            workspaceId,
            repoUrl,
            defaultBranch,
            headCommit,
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { workspaceId, repoPath, defaultBranch, headCommit },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("repo_clone_failed", { workspaceId, error: msg });
          return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    server.tool(
      MCP_TOOLS.REPO_CHECKOUT_BRANCH,
      "Create or checkout a branch in a workspace's repo.",
      {
        workspaceId: z.string().min(6),
        branch: z.string().min(1),
        fromBase: z.string().optional(),
      },
      async ({ workspaceId, branch, fromBase }) => {
        try {
          const g = git(workspaceId);
          const branches = await g.branch();
          if (branches.all.includes(branch)) {
            await g.checkout(branch);
          } else if (fromBase) {
            await g.checkout(fromBase);
            await g.pull("origin", fromBase, { "--ff-only": null });
            await g.checkoutLocalBranch(branch);
          } else {
            await g.checkoutLocalBranch(branch);
          }
          return {
            content: [{ type: "text", text: JSON.stringify({ branch }) }],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    server.tool(
      MCP_TOOLS.REPO_STATUS,
      "Get repo status (branch, ahead/behind, dirty files).",
      { workspaceId: z.string().min(6) },
      async ({ workspaceId }) => {
        try {
          if (!workspaceManager.exists(workspaceId)) {
            throw new AppError("WORKSPACE_NOT_FOUND", "Workspace missing");
          }
          const g = git(workspaceId);
          const status = await g.status();
          return {
            content: [
              { type: "text", text: JSON.stringify(status, null, 2) },
            ],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );
  },
};
