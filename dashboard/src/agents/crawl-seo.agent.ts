import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import { AGENTS } from "@growth/shared/constants";
import type {
  CrawlSiteOutput,
  LighthouseRunOutput,
  CrawlSiteInput,
  LighthouseRunInput,
} from "@growth/shared/types";
import type { McpClientPort } from "@/core/ports/mcp.port";

export interface CrawlSeoInput {
  siteUrl: string;
}

export interface CrawlSeoOutput {
  crawl: CrawlSiteOutput;
  baseline: LighthouseRunOutput;
  auditNarrative: string;
  detectedLocalities: string[];
  framework: string | null;
}

export class CrawlSeoAgent extends BaseAgent<CrawlSeoInput, CrawlSeoOutput> {
  readonly name = "crawl_seo" as const;
  readonly title = AGENTS.crawl_seo.displayName;
  readonly model = AGENTS.crawl_seo.model;

  constructor(private mcp: McpClientPort) {
    super();
  }

  async run(ctx: AgentContext, input: CrawlSeoInput): Promise<CrawlSeoOutput> {
    const span = ctx.tracer.startSpan({
      name: "agent.crawl_seo",
      kind: "agent",
      runId: ctx.runId,
      parentSpanId: ctx.parentSpan?.spanId ?? null,
      attributes: { siteUrl: input.siteUrl },
    });
    const step = this.createStep(
      ctx,
      `Crawl & audit ${input.siteUrl}`,
      input,
      null,
    );

    try {
      const trace = { traceId: span.traceId, parentSpanId: span.spanId };

      const [crawl, baseline] = await Promise.all([
        this.mcp.crawlSite({ url: input.siteUrl, maxPages: 12 }, trace),
        this.mcp.lighthouseRun({ url: input.siteUrl, formFactor: "mobile" }, trace),
      ]);

      const detectedLocalities = this.extractLocalitiesFromCrawl(crawl);

      const tools: Array<ToolDef<unknown, unknown>> = [
        {
          name: "inspect_page",
          description: "Fetch a single URL and re-extract SEO signals (use only if a page in the crawl needs deeper inspection).",
          input_schema: {
            type: "object",
            properties: { url: { type: "string" } },
            required: ["url"],
          },
          execute: async (raw) => {
            const i = raw as { url: string };
            return this.mcp.crawlSite(
              { url: i.url, maxPages: 1 } as CrawlSiteInput,
              trace,
            );
          },
        },
        {
          name: "rerun_lighthouse",
          description: "Re-run Lighthouse against a URL (useful if mobile vs desktop comparison is needed).",
          input_schema: {
            type: "object",
            properties: {
              url: { type: "string" },
              formFactor: { type: "string", enum: ["mobile", "desktop"] },
            },
            required: ["url"],
          },
          execute: async (raw) => {
            const i = raw as { url: string; formFactor?: "mobile" | "desktop" };
            return this.mcp.lighthouseRun(
              {
                url: i.url,
                formFactor: i.formFactor ?? "mobile",
              } as LighthouseRunInput,
              trace,
            );
          },
        },
      ];

      const system = `You are the Crawl & SEO Audit Agent for an autonomous growth-engineering platform that operates on real-estate websites.
You will be given the crawl output (pages, metadata, links, schema) and a baseline Lighthouse report.
Produce a concise, prioritized audit narrative that names concrete weaknesses by file/route. Focus on:
- metadata gaps (title, description, OG, Twitter, canonical),
- structured data gaps (RealEstateListing, Organization, BreadcrumbList, FAQPage),
- locality / geo-intent gaps (missing locality landing pages),
- internal linking weaknesses,
- on-page accessibility / Lighthouse failures,
- sitemap & robots.

Do NOT recommend fixes — only describe what is wrong, where, and why it matters. Be specific (mention page URLs / route patterns). 300 words max.`;

      const userPrompt = `CRAWL OUTPUT:
\`\`\`json
${JSON.stringify(crawl, null, 2).slice(0, 12000)}
\`\`\`

LIGHTHOUSE BASELINE (mobile):
\`\`\`json
${JSON.stringify(baseline, null, 2).slice(0, 8000)}
\`\`\`

Use the tools only if a specific page needs deeper inspection. Then produce the audit narrative.`;

      const { text: auditNarrative } = await this.toolLoop(ctx, span, {
        system,
        userPrompt,
        tools,
        maxRounds: 4,
      });

      const output: CrawlSeoOutput = {
        crawl,
        baseline,
        auditNarrative,
        detectedLocalities,
        framework: crawl.framework,
      };
      this.completeStep(ctx, step, {
        pagesCrawled: crawl.pages.length,
        baselineScores: baseline.scores,
        localities: detectedLocalities,
      });
      span.end({
        status: "ok",
        attributes: {
          pagesCrawled: crawl.pages.length,
          baselinePerf: baseline.scores.performance,
        },
      });
      return output;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.failStep(ctx, step, e);
      span.end({ status: "error", error: e });
      throw e;
    }
  }

  private extractLocalitiesFromCrawl(crawl: CrawlSiteOutput): string[] {
    const KNOWN = [
      "Whitefield",
      "Sarjapur",
      "Indiranagar",
      "Koramangala",
      "Electronic City",
      "Devanahalli",
      "Hebbal",
      "JP Nagar",
      "HSR Layout",
      "BTM",
      "Marathahalli",
    ];
    const found = new Set<string>();
    for (const page of crawl.pages) {
      const haystack = [
        page.title ?? "",
        page.description ?? "",
        page.url,
      ].join(" ");
      for (const loc of KNOWN) {
        if (haystack.toLowerCase().includes(loc.toLowerCase())) found.add(loc);
      }
    }
    return Array.from(found);
  }
}
