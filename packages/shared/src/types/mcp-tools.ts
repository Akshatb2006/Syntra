/**
 * Type contracts for MCP tool inputs and outputs.
 * The MCP server registers tools matching these shapes; the dashboard's
 * typed MCPClient consumes them. Keep names in sync with constants/tools.ts.
 */

export interface RepoCloneInput {
  workspaceId: string;
  repoUrl: string;
  githubToken: string;
  branchBase?: string;
}

export interface RepoCloneOutput {
  workspaceId: string;
  repoPath: string;
  defaultBranch: string;
  headCommit: string;
}

export interface FsReadInput {
  workspaceId: string;
  path: string;
}

export interface FsReadOutput {
  path: string;
  content: string;
  bytes: number;
}

export interface FsListInput {
  workspaceId: string;
  path: string;
}

export interface FsListEntry {
  name: string;
  isDirectory: boolean;
  size: number;
}

export interface FsListOutput {
  path: string;
  entries: FsListEntry[];
}

export interface LighthouseRunInput {
  url: string;
  formFactor?: "mobile" | "desktop";
  onlyCategories?: Array<"performance" | "accessibility" | "best-practices" | "seo">;
}

export interface LighthouseRunOutput {
  url: string;
  fetchedAt: number;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  diagnostics: LighthouseDiagnostic[];
}

export interface LighthouseDiagnostic {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  numericValue?: number;
  displayValue?: string;
}

export interface CrawlSiteInput {
  url: string;
  maxPages?: number;
  sameOriginOnly?: boolean;
}

export interface CrawledPage {
  url: string;
  status: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  h1Count: number;
  h2Count: number;
  /** Visible text of the page's <h1> elements (bounded). High-signal for page-type + entities. */
  h1Text: string[];
  /** Visible text of the page's <h2> elements (bounded). */
  h2Text: string[];
  /** Anchor text of the page's internal links (bounded). Where brand/location/product entities surface. */
  linkTexts: string[];
  imagesMissingAlt: number;
  hasStructuredData: boolean;
  structuredDataTypes: string[];
  internalLinks: string[];
  externalLinks: string[];
  wordCount: number;
}

export interface CrawlSiteOutput {
  rootUrl: string;
  pages: CrawledPage[];
  sitemapFound: boolean;
  robotsFound: boolean;
  framework: string | null;
}

export interface ShellRunInput {
  workspaceId: string;
  command: string;
  args: string[];
  timeoutMs?: number;
}

export interface ShellRunOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface VercelPreviewLookupInput {
  vercelToken: string;
  projectId: string;
  teamId?: string;
  branch: string;
  commitSha?: string;
  timeoutMs?: number;
}

export interface VercelPreviewLookupOutput {
  previewUrl: string | null;
  status: "ready" | "building" | "error" | "queued" | "unknown";
  deploymentId: string | null;
}
