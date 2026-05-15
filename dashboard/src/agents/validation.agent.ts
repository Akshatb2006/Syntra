import { BaseAgent, type AgentContext } from "./base";
import { AGENTS } from "@growth/shared/constants";
import type { LighthouseRunOutput, RunDelta, LighthouseSummary } from "@growth/shared/types";
import type { McpClientPort } from "@/core/ports/mcp.port";

export interface ValidationInput {
  baseline: LighthouseRunOutput;
  previewUrl: string;
  vercelToken?: string;
  vercelProjectId?: string;
  vercelTeamId?: string;
  branch?: string;
  commitSha?: string;
  waitForPreviewMs?: number;
}

export interface ValidationOutput {
  after: LighthouseRunOutput;
  delta: RunDelta;
  baselineSummary: LighthouseSummary;
  afterSummary: LighthouseSummary;
  narrative: string;
}

export class ValidationAgent extends BaseAgent<ValidationInput, ValidationOutput> {
  readonly name = "validation" as const;
  readonly title = AGENTS.validation.displayName;
  readonly model = AGENTS.validation.model;

  constructor(private mcp: McpClientPort) {
    super();
  }

  async run(ctx: AgentContext, input: ValidationInput): Promise<ValidationOutput> {
    const span = ctx.tracer.startSpan({
      name: "agent.validation",
      kind: "validation",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { previewUrl: input.previewUrl },
    });
    const step = this.createStep(
      ctx,
      `Validate preview ${input.previewUrl}`,
      { previewUrl: input.previewUrl },
      null,
    );

    try {
      const trace = { traceId: span.traceId, parentSpanId: span.spanId };
      const after = await this.mcp.lighthouseRun(
        { url: input.previewUrl, formFactor: "mobile" },
        trace,
      );
      const delta: RunDelta = {
        performance: after.scores.performance - input.baseline.scores.performance,
        accessibility:
          after.scores.accessibility - input.baseline.scores.accessibility,
        bestPractices:
          after.scores.bestPractices - input.baseline.scores.bestPractices,
        seo: after.scores.seo - input.baseline.scores.seo,
      };
      const narrative = this.summarizeDelta(input.baseline, after, delta);

      const baselineSummary: LighthouseSummary = {
        url: input.baseline.url,
        performance: input.baseline.scores.performance,
        accessibility: input.baseline.scores.accessibility,
        bestPractices: input.baseline.scores.bestPractices,
        seo: input.baseline.scores.seo,
        fetchedAt: input.baseline.fetchedAt,
      };
      const afterSummary: LighthouseSummary = {
        url: after.url,
        performance: after.scores.performance,
        accessibility: after.scores.accessibility,
        bestPractices: after.scores.bestPractices,
        seo: after.scores.seo,
        fetchedAt: after.fetchedAt,
      };

      this.completeStep(ctx, step, { delta, narrative });
      span.end({ status: "ok", attributes: { delta } });
      return { after, delta, baselineSummary, afterSummary, narrative };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      throw e;
    }
  }

  private summarizeDelta(
    baseline: LighthouseRunOutput,
    after: LighthouseRunOutput,
    delta: RunDelta,
  ): string {
    const parts: string[] = [];
    parts.push(
      `Lighthouse (mobile): perf ${baseline.scores.performance} → ${after.scores.performance} (${signed(delta.performance)})`,
    );
    parts.push(
      `SEO ${baseline.scores.seo} → ${after.scores.seo} (${signed(delta.seo)})`,
    );
    parts.push(
      `A11y ${baseline.scores.accessibility} → ${after.scores.accessibility} (${signed(delta.accessibility)})`,
    );
    parts.push(
      `Best practices ${baseline.scores.bestPractices} → ${after.scores.bestPractices} (${signed(delta.bestPractices)})`,
    );
    return parts.join(" · ");
  }
}

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return "0";
}
