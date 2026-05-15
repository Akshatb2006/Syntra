import { z } from "zod";
import { Octokit } from "@octokit/rest";
import type { Plugin } from "./types.js";
import { MCP_TOOLS } from "@growth/shared/constants";
import { config } from "../config.js";

function makeOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

function splitRepoFullName(repoFullName: string): [string, string] {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) throw new Error(`Invalid repo full name: ${repoFullName}`);
  return [owner, repo];
}

export const githubPlugin: Plugin = {
  name: "github",
  register(server) {
    server.tool(
      MCP_TOOLS.GITHUB_PR_GET,
      "Get details for a GitHub pull request (title, state, mergeable, head sha).",
      {
        repoFullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        prNumber: z.number().int().positive(),
        githubToken: z.string().optional(),
      },
      async ({ repoFullName, prNumber, githubToken }) => {
        const token = githubToken ?? config.defaultGithubToken;
        if (!token) {
          return {
            content: [{ type: "text", text: "Error: githubToken required" }],
            isError: true,
          };
        }
        try {
          const [owner, repo] = splitRepoFullName(repoFullName);
          const octo = makeOctokit(token);
          const { data } = await octo.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
          });
          const summary = {
            number: data.number,
            title: data.title,
            state: data.state,
            merged: data.merged,
            mergeable: data.mergeable,
            head: { sha: data.head.sha, ref: data.head.ref },
            base: { sha: data.base.sha, ref: data.base.ref },
            html_url: data.html_url,
          };
          return {
            content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
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
      MCP_TOOLS.GITHUB_PR_LIST_FOR_BRANCH,
      "List open PRs whose head branch matches a given name.",
      {
        repoFullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        branch: z.string().min(1),
        githubToken: z.string().optional(),
      },
      async ({ repoFullName, branch, githubToken }) => {
        const token = githubToken ?? config.defaultGithubToken;
        if (!token) {
          return {
            content: [{ type: "text", text: "Error: githubToken required" }],
            isError: true,
          };
        }
        try {
          const [owner, repo] = splitRepoFullName(repoFullName);
          const octo = makeOctokit(token);
          const { data } = await octo.pulls.list({
            owner,
            repo,
            state: "open",
            head: `${owner}:${branch}`,
            per_page: 10,
          });
          const summary = data.map((pr) => ({
            number: pr.number,
            title: pr.title,
            html_url: pr.html_url,
            head: pr.head.ref,
            updated_at: pr.updated_at,
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
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
