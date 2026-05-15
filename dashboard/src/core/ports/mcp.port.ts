import type {
  CrawlSiteInput,
  CrawlSiteOutput,
  DispatchCodeEditRequest,
  DispatchCodeEditResponse,
  DispatchJobStatus,
  FsListInput,
  FsListOutput,
  FsReadInput,
  FsReadOutput,
  LighthouseRunInput,
  LighthouseRunOutput,
  RepoCloneInput,
  RepoCloneOutput,
  ShellRunInput,
  ShellRunOutput,
  VercelPreviewLookupInput,
  VercelPreviewLookupOutput,
} from "@growth/shared/types";
import type { TraceContext } from "@growth/shared/types";

export interface McpClientPort {
  health(): Promise<{ status: string; plugins: string[]; users: number }>;

  // Repo / FS / Shell
  repoClone(input: RepoCloneInput, trace: TraceContext): Promise<RepoCloneOutput>;
  repoCheckoutBranch(
    input: { workspaceId: string; branch: string; fromBase?: string },
    trace: TraceContext,
  ): Promise<{ branch: string }>;
  fsRead(input: FsReadInput, trace: TraceContext): Promise<FsReadOutput>;
  fsList(input: FsListInput, trace: TraceContext): Promise<FsListOutput>;
  shellRun(input: ShellRunInput, trace: TraceContext): Promise<ShellRunOutput>;

  // Analysis
  lighthouseRun(
    input: LighthouseRunInput,
    trace: TraceContext,
  ): Promise<LighthouseRunOutput>;
  crawlSite(
    input: CrawlSiteInput,
    trace: TraceContext,
  ): Promise<CrawlSiteOutput>;

  // Integrations
  vercelPreviewLookup(
    input: VercelPreviewLookupInput,
    trace: TraceContext,
  ): Promise<VercelPreviewLookupOutput>;

  // Dispatch
  dispatchCodeEdit(
    req: DispatchCodeEditRequest,
    githubToken: string,
  ): Promise<DispatchCodeEditResponse>;
  dispatchJobStatus(jobId: string): Promise<DispatchJobStatus>;

  // SSE
  subscribeEvents(onEvent: (event: unknown) => void): () => void;
}
