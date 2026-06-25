import { BaseAgent, type AgentContext, type ToolDef } from "./base";
import { AGENTS } from "@growth/shared/constants";
import {
  DEFAULT_BUSINESS_PROFILE,
  type BusinessProfile,
  type BusinessProfileHint,
  type CrawlSiteOutput,
  type LighthouseRunOutput,
  type CrawlSiteInput,
  type LighthouseRunInput,
  type SiteUnderstanding,
} from "@growth/shared/types";
import type { McpClientPort } from "@/core/ports/mcp.port";
import type { SpanHandle } from "@/core/ports/tracer.port";
import { SiteUnderstandingAgent } from "./site-understanding.agent";

export interface CrawlSeoInput {
  siteUrl: string;
  profileHint?: BusinessProfileHint;
}

export interface CrawlSeoOutput {
  crawl: CrawlSiteOutput;
  baseline: LighthouseRunOutput;
  auditNarrative: string;
  /** What kind of business this is — drives every downstream prompt. */
  businessProfile: BusinessProfile;
  /** Geographic areas the site currently targets (empty when not location-based). */
  detectedLocalities: string[];
  /** Breakdown of crawled pages by type — the "Site Understanding" signal. */
  pageTypes: Array<{ type: string; count: number }>;
  /**
   * Business-aware understanding of the site: per-page classification, the
   * entities it talks about, and detected content gaps. Drives the content_gap
   * detector and the Site Understanding panel.
   */
  understanding: SiteUnderstanding;
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
        this.mcp.crawlSite({ url: input.siteUrl, maxPages: 30 }, trace),
        this.mcp.lighthouseRun({ url: input.siteUrl, formFactor: "mobile" }, trace),
      ]);

      // Classify the business first so the audit (and everything downstream)
      // adapts to the industry instead of assuming real estate.
      const { profile: businessProfile, localities: detectedLocalities } =
        await this.detectBusinessProfile(ctx, span, crawl, input.profileHint);

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

      const schemaList = businessProfile.schemaTypes.join(", ");
      const localityLine = businessProfile.locationBased
        ? "- local / geo-intent gaps (missing location landing pages for the areas this business serves),\n"
        : "";
      const system = `You are the Crawl & SEO Audit Agent for an autonomous growth-engineering platform that works on websites in any industry.
The target site is a ${businessProfile.industry} business${businessProfile.locationBased ? " that serves customers in specific locations" : ""}.
You will be given the crawl output (pages, metadata, links, schema) and a baseline Lighthouse report.
Produce a concise, prioritized audit narrative that names concrete weaknesses by file/route. Focus on:
- metadata gaps (title, description, OG, Twitter, canonical),
- structured data gaps (relevant schema.org types for this business: ${schemaList}, plus Organization, BreadcrumbList, FAQPage),
${localityLine}- internal linking weaknesses,
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

      // Business-aware site understanding (hybrid page classification + entity
      // extraction + content-gap detection). Runs as its own sub-step; degrades
      // to a deterministic classification on any failure.
      const understanding = await new SiteUnderstandingAgent().run(
        { ...ctx, parentSpan: span },
        { siteUrl: input.siteUrl, crawl, profile: businessProfile },
      );
      const pageTypes = understanding.pageTypes;

      const output: CrawlSeoOutput = {
        crawl,
        baseline,
        auditNarrative,
        businessProfile,
        detectedLocalities,
        pageTypes,
        understanding,
        framework: crawl.framework,
      };
      this.completeStep(ctx, step, {
        pagesCrawled: crawl.pages.length,
        baselineScores: baseline.scores,
        businessProfile,
        pageTypes,
        localities: detectedLocalities,
        // Compact understanding summary for the Site Understanding panel.
        understanding: {
          mode: understanding.mode,
          taxonomy: understanding.taxonomy,
          entities: understanding.entities.slice(0, 12).map((e) => ({
            name: e.name,
            kind: e.kind,
            mentions: e.mentions,
            pages: e.pages.length,
            ownership: e.ownership,
            coverageDepth: e.coverageDepth,
          })),
          contentGaps: understanding.contentGaps,
        },
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

  /**
   * Classify the business from the crawl (industry, location-based, schema
   * types) and pull out any geographic areas the site already targets. This
   * replaces the old hardcoded Bangalore locality list — the model reads the
   * actual pages, so it works for any industry and any geography. Never throws:
   * on any failure it falls back to the operator hint or a neutral profile.
   */
  private async detectBusinessProfile(
    ctx: AgentContext,
    span: SpanHandle,
    crawl: CrawlSiteOutput,
    hint?: BusinessProfileHint,
  ): Promise<{ profile: BusinessProfile; localities: string[] }> {
    const digest = crawl.pages
      .slice(0, 10)
      .map(
        (p) =>
          `- ${p.url}\n  title: ${p.title ?? "(none)"}\n  desc: ${(p.description ?? "(none)").slice(0, 160)}\n  schema: ${p.structuredDataTypes.join(", ") || "(none)"}`,
      )
      .join("\n");

    const hintLine =
      hint && (hint.industry || hint.locationBased !== undefined)
        ? `\nOperator hint (trust it, fill in the rest): industry=${hint.industry ?? "?"}, locationBased=${hint.locationBased ?? "?"}.`
        : "";

    const system = `You classify what kind of business a website is, for an SEO platform that must work across ANY industry. Output ONLY a single JSON object, no prose:
{
  "industry": "<short label, e.g. SaaS, Healthcare, E-commerce, Real Estate, Law Firm, Restaurant, Media/Blog, Education>",
  "locationBased": <true if the business serves customers in specific geographic places (clinics, real estate, restaurants, local services); false for global/online products (SaaS, blogs, most e-commerce)>,
  "schemaTypes": ["<2-4 relevant schema.org types: SoftwareApplication, MedicalBusiness, RealEstateListing, Product, LocalBusiness, Restaurant, FAQPage, Organization, Article>"],
  "audience": "<one line: who the site serves>",
  "summary": "<one line: what the site is>",
  "localitiesServed": ["<geographic areas / neighborhoods / cities the site currently targets; [] if none or not location-based>"]
}`;

    const userPrompt = `Site: ${crawl.rootUrl}
Framework: ${crawl.framework ?? "(unknown)"}

Crawled pages:
${digest}${hintLine}

Classify now. Output only the JSON object.`;

    try {
      const { text } = await this.toolLoop(ctx, span, {
        system,
        userPrompt,
        tools: [],
        maxRounds: 1,
      });
      const parsed = this.parseProfileJson(text);
      if (parsed) {
        const profile: BusinessProfile = {
          industry: hint?.industry ?? parsed.industry ?? DEFAULT_BUSINESS_PROFILE.industry,
          locationBased:
            hint?.locationBased ?? parsed.locationBased ?? DEFAULT_BUSINESS_PROFILE.locationBased,
          schemaTypes:
            Array.isArray(parsed.schemaTypes) && parsed.schemaTypes.length > 0
              ? parsed.schemaTypes
              : DEFAULT_BUSINESS_PROFILE.schemaTypes,
          audience: parsed.audience,
          summary: parsed.summary,
        };
        const localities = profile.locationBased
          ? (parsed.localitiesServed ?? []).filter((l): l is string => typeof l === "string")
          : [];
        return { profile, localities };
      }
    } catch {
      // fall through to the neutral fallback below
    }

    return {
      profile: {
        ...DEFAULT_BUSINESS_PROFILE,
        ...(hint?.industry ? { industry: hint.industry } : {}),
        ...(hint?.locationBased !== undefined ? { locationBased: hint.locationBased } : {}),
      },
      localities: [],
    };
  }

  private parseProfileJson(text: string): {
    industry?: string;
    locationBased?: boolean;
    schemaTypes?: string[];
    audience?: string;
    summary?: string;
    localitiesServed?: string[];
  } | null {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
