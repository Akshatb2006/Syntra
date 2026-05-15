import { Octokit } from "@octokit/rest";
import { z } from "zod";

export const name = "github";

export function register(server, config) {
  if (!config.githubToken || !config.githubRepo) {
    console.warn("GitHub plugin: missing GITHUB_TOKEN or GITHUB_REPO — skipping");
    return;
  }

  const octokit = new Octokit({ auth: config.githubToken });
  const [owner, repo] = config.githubRepo.split("/");

  server.tool(
    "list_prs",
    "List recent pull requests",
    {
      state: z.enum(["open", "closed", "all"]).default("open").describe("PR state filter"),
      limit: z.number().default(10).describe("Max PRs to return"),
    },
    async ({ state, limit }) => {
      try {
        const { data } = await octokit.pulls.list({
          owner,
          repo,
          state,
          per_page: limit,
          sort: "updated",
          direction: "desc",
        });
        const prs = data.map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user?.login,
          updated: pr.updated_at,
          url: pr.html_url,
        }));
        return { content: [{ type: "text", text: JSON.stringify(prs, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_pr_diff",
    "Get the diff of a specific pull request",
    { pr_number: z.number().describe("Pull request number") },
    async ({ pr_number }) => {
      try {
        const { data } = await octokit.pulls.get({
          owner,
          repo,
          pull_number: pr_number,
          mediaType: { format: "diff" },
        });
        const diff = typeof data === "string" ? data : JSON.stringify(data);
        // Truncate if too long
        const truncated = diff.length > 10000 ? diff.slice(0, 10000) + "\n... (truncated)" : diff;
        return { content: [{ type: "text", text: truncated }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_issues",
    "List recent issues",
    {
      state: z.enum(["open", "closed", "all"]).default("open").describe("Issue state filter"),
      limit: z.number().default(10).describe("Max issues to return"),
    },
    async ({ state, limit }) => {
      try {
        const { data } = await octokit.issues.listForRepo({
          owner,
          repo,
          state,
          per_page: limit,
          sort: "updated",
          direction: "desc",
        });
        const issues = data
          .filter((i) => !i.pull_request) // Exclude PRs
          .map((i) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            author: i.user?.login,
            labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
            updated: i.updated_at,
          }));
        return { content: [{ type: "text", text: JSON.stringify(issues, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "create_issue",
    "Create a new GitHub issue",
    {
      title: z.string().describe("Issue title"),
      body: z.string().default("").describe("Issue body (markdown)"),
      labels: z.array(z.string()).default([]).describe("Labels to apply"),
    },
    async ({ title, body, labels }) => {
      try {
        const { data } = await octokit.issues.create({
          owner,
          repo,
          title,
          body,
          labels,
        });
        return {
          content: [{ type: "text", text: `Created issue #${data.number}: ${data.html_url}` }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
