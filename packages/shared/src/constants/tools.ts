/**
 * Canonical MCP tool names. The mcp-server registers tools under these names;
 * the dashboard MCPClient invokes them by name.
 */

export const MCP_TOOLS = {
  // repo + filesystem
  REPO_CLONE: "repo_clone",
  REPO_STATUS: "repo_status",
  REPO_CHECKOUT_BRANCH: "repo_checkout_branch",
  FS_READ: "fs_read",
  FS_WRITE: "fs_write",
  FS_LIST: "fs_list",
  // analysis
  LIGHTHOUSE_RUN: "lighthouse_run",
  CRAWL_SITE: "crawl_site",
  PARSE_PAGE_SEO: "parse_page_seo",
  // execution
  SHELL_RUN: "shell_run",
  // integrations
  VERCEL_PREVIEW_LOOKUP: "vercel_preview_lookup",
  GITHUB_PR_GET: "github_pr_get",
  GITHUB_PR_LIST_FOR_BRANCH: "github_pr_list_for_branch",
} as const;

export type McpToolName = (typeof MCP_TOOLS)[keyof typeof MCP_TOOLS];

export const MCP_ROUTES = {
  MCP: "/mcp",
  HEALTH: "/health",
  DISPATCH_CODE_EDIT: "/dispatch/code-edit",
  DISPATCH_JOB_LOG: "/dispatch/code-edit/:jobId/log",
  DISPATCH_JOB_STATUS: "/dispatch/code-edit/:jobId/status",
  WEBHOOK_GITHUB: "/webhooks/github",
  WEBHOOK_VERCEL: "/webhooks/vercel",
  EVENTS_SSE: "/events",
} as const;
