import type { McpClientPort } from "@/core/ports/mcp.port";
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
import { TRACE_HEADER, type TraceContext } from "@growth/shared/types";
import { MCP_TOOLS, MCP_ROUTES } from "@growth/shared/constants";
import { env } from "@/lib/env";
import { DomainError } from "@/core/errors";
import { logger } from "@/lib/logger";

interface ClientOptions {
  baseUrl?: string;
  bearer?: string;
  fetchImpl?: typeof fetch;
}

interface McpToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: McpToolResponse;
  error?: { code: number; message: string };
}

/**
 * Thin MCP HTTP client. Initializes a session lazily, then routes typed calls
 * to `tools/call`. For brevity we issue one JSON-RPC per call and let the
 * server pool sessions internally.
 */
export class McpHttpClient implements McpClientPort {
  private baseUrl: string;
  private bearer: string;
  private fetchImpl: typeof fetch;
  private sessionId: string | null = null;
  private requestId = 0;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? env.mcpBaseUrl).replace(/\/$/, "");
    this.bearer = opts.bearer ?? env.mcpBearer;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async health(): Promise<{ status: string; plugins: string[]; users: number }> {
    const res = await this.fetchImpl(`${this.baseUrl}${MCP_ROUTES.HEALTH}`);
    if (!res.ok) throw new DomainError("DEPENDENCY_MISSING", `MCP health ${res.status}`);
    return (await res.json()) as { status: string; plugins: string[]; users: number };
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionId) return;
    const id = ++this.requestId;
    const res = await this.fetchImpl(`${this.baseUrl}${MCP_ROUTES.MCP}`, {
      method: "POST",
      headers: this.baseHeaders({}),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "growth-dashboard", version: "0.1.0" },
        },
      }),
    });
    if (!res.ok) throw new DomainError("DEPENDENCY_MISSING", `MCP init ${res.status}`);
    this.sessionId = res.headers.get("mcp-session-id");
    if (!this.sessionId)
      throw new DomainError("DEPENDENCY_MISSING", "MCP did not return session id");
    // discard body
    await res.text();
  }

  private baseHeaders(trace: TraceContext | Record<string, never>): Record<string, string> {
    const h: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${this.bearer}`,
    };
    if (this.sessionId) h["mcp-session-id"] = this.sessionId;
    if ("traceId" in trace && trace.traceId) {
      h[TRACE_HEADER.TRACE_ID] = trace.traceId;
      if (trace.parentSpanId) h[TRACE_HEADER.PARENT_SPAN_ID] = trace.parentSpanId;
    }
    return h;
  }

  /**
   * MCP's StreamableHTTPServerTransport responds with either `application/json`
   * or `text/event-stream` depending on whether the tool is streaming. Parse
   * both shapes into the same JSON-RPC envelope.
   */
  private async readJsonRpcResponse(res: Response): Promise<McpJsonRpcResponse> {
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("application/json")) {
      return (await res.json()) as McpJsonRpcResponse;
    }
    if (ct.includes("text/event-stream")) {
      const text = await res.text();
      // SSE frames look like:
      //   event: message
      //   data: {"jsonrpc":"2.0","id":1,"result":{...}}
      //   <blank line>
      // For a single-shot tools/call there's usually exactly one `data:` line.
      let last: McpJsonRpcResponse | null = null;
      for (const line of text.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(line[5] === " " ? 6 : 5);
        try {
          last = JSON.parse(payload) as McpJsonRpcResponse;
        } catch {
          // skip malformed frames
        }
      }
      if (!last) {
        throw new DomainError(
          "MCP_TOOL_FAILED",
          `MCP returned SSE with no parseable data frame (${text.slice(0, 200)}…)`,
        );
      }
      return last;
    }
    // Unknown content-type — try JSON as a last resort.
    const text = await res.text();
    try {
      return JSON.parse(text) as McpJsonRpcResponse;
    } catch {
      throw new DomainError(
        "MCP_TOOL_FAILED",
        `Unexpected MCP response (content-type=${ct || "none"}): ${text.slice(0, 200)}…`,
      );
    }
  }

  private async callTool<T>(
    name: string,
    args: object,
    trace: TraceContext,
  ): Promise<T> {
    await this.ensureSession();
    const id = ++this.requestId;
    const res = await this.fetchImpl(`${this.baseUrl}${MCP_ROUTES.MCP}`, {
      method: "POST",
      headers: this.baseHeaders(trace),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new DomainError("MCP_TOOL_FAILED", `${name} HTTP ${res.status}: ${body}`);
    }
    const payload = await this.readJsonRpcResponse(res);
    if (payload.error)
      throw new DomainError("MCP_TOOL_FAILED", `${name}: ${payload.error.message}`);
    const result = payload.result;
    if (!result || result.isError) {
      const text = result?.content?.[0]?.text ?? "tool returned error";
      throw new DomainError("MCP_TOOL_FAILED", `${name}: ${text}`);
    }
    const text = result.content[0]?.text ?? "";
    try {
      return JSON.parse(text) as T;
    } catch {
      // Some tools return raw text intentionally; cast to unknown.
      return text as unknown as T;
    }
  }

  repoClone(input: RepoCloneInput, trace: TraceContext) {
    return this.callTool<RepoCloneOutput>(MCP_TOOLS.REPO_CLONE, input, trace);
  }
  repoCheckoutBranch(
    input: { workspaceId: string; branch: string; fromBase?: string },
    trace: TraceContext,
  ) {
    return this.callTool<{ branch: string }>(
      MCP_TOOLS.REPO_CHECKOUT_BRANCH,
      input,
      trace,
    );
  }
  fsRead(input: FsReadInput, trace: TraceContext) {
    return this.callTool<FsReadOutput>(MCP_TOOLS.FS_READ, input, trace);
  }
  fsList(input: FsListInput, trace: TraceContext) {
    return this.callTool<FsListOutput>(MCP_TOOLS.FS_LIST, input, trace);
  }
  shellRun(input: ShellRunInput, trace: TraceContext) {
    return this.callTool<ShellRunOutput>(MCP_TOOLS.SHELL_RUN, input, trace);
  }
  lighthouseRun(input: LighthouseRunInput, trace: TraceContext) {
    return this.callTool<LighthouseRunOutput>(MCP_TOOLS.LIGHTHOUSE_RUN, input, trace);
  }
  crawlSite(input: CrawlSiteInput, trace: TraceContext) {
    return this.callTool<CrawlSiteOutput>(MCP_TOOLS.CRAWL_SITE, input, trace);
  }
  vercelPreviewLookup(input: VercelPreviewLookupInput, trace: TraceContext) {
    return this.callTool<VercelPreviewLookupOutput>(
      MCP_TOOLS.VERCEL_PREVIEW_LOOKUP,
      input,
      trace,
    );
  }

  async dispatchCodeEdit(
    req: DispatchCodeEditRequest,
    githubToken: string,
  ): Promise<DispatchCodeEditResponse> {
    const res = await this.fetchImpl(
      `${this.baseUrl}${MCP_ROUTES.DISPATCH_CODE_EDIT}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.bearer}`,
          "x-github-token": githubToken,
          [TRACE_HEADER.TRACE_ID]: req.traceContext.traceId,
          ...(req.traceContext.parentSpanId
            ? { [TRACE_HEADER.PARENT_SPAN_ID]: req.traceContext.parentSpanId }
            : {}),
        },
        body: JSON.stringify(req),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new DomainError("DISPATCH_FAILED", `Dispatch ${res.status}: ${body}`);
    }
    return (await res.json()) as DispatchCodeEditResponse;
  }

  async dispatchJobStatus(jobId: string): Promise<DispatchJobStatus> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/dispatch/code-edit/${jobId}/status`,
      { headers: { authorization: `Bearer ${this.bearer}` } },
    );
    if (!res.ok)
      throw new DomainError("DISPATCH_FAILED", `Job status ${res.status}`);
    return (await res.json()) as DispatchJobStatus;
  }

  subscribeEvents(onEvent: (event: unknown) => void): () => void {
    const ac = new AbortController();
    const url = `${this.baseUrl}${MCP_ROUTES.EVENTS_SSE}`;
    this.fetchImpl(url, {
      headers: { authorization: `Bearer ${this.bearer}`, accept: "text/event-stream" },
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          logger.warn("mcp_sse_failed", { status: res.status });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const block of events) {
            const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              onEvent(JSON.parse(dataLine.slice(6)));
            } catch {
              // ignore bad lines
            }
          }
        }
      })
      .catch((err) => {
        if ((err as { name?: string }).name === "AbortError") return;
        logger.warn("mcp_sse_error", { error: err instanceof Error ? err.message : String(err) });
      });
    return () => ac.abort();
  }
}

let cached: McpHttpClient | null = null;
export function getMcp(): McpHttpClient {
  if (!cached) cached = new McpHttpClient();
  return cached;
}
