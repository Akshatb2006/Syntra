import { z } from "zod";
import { chromium, type Browser } from "playwright";
import { logger } from "../lib/logger.js";
import type { Plugin } from "./types.js";
import { MCP_TOOLS } from "@growth/shared/constants";
import type { CrawlSiteOutput, CrawledPage } from "@growth/shared/types";

interface ExtractedMeta {
  title: string | null;
  description: string | null;
  canonical: string | null;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  h1Count: number;
  h2Count: number;
  imagesMissingAlt: number;
  hasStructuredData: boolean;
  structuredDataTypes: string[];
  internalLinks: string[];
  externalLinks: string[];
  wordCount: number;
  generator: string | null;
}

const META_EXTRACTOR = (rootOrigin: string): string => `
(() => {
  const out = {
    title: document.title || null,
    description: null,
    canonical: null,
    ogTags: {},
    twitterTags: {},
    h1Count: document.querySelectorAll('h1').length,
    h2Count: document.querySelectorAll('h2').length,
    imagesMissingAlt: 0,
    hasStructuredData: false,
    structuredDataTypes: [],
    internalLinks: [],
    externalLinks: [],
    wordCount: (document.body?.innerText || '').trim().split(/\\s+/).filter(Boolean).length,
    generator: null,
  };
  const desc = document.querySelector('meta[name="description"]');
  if (desc) out.description = desc.getAttribute('content');
  const can = document.querySelector('link[rel="canonical"]');
  if (can) out.canonical = can.getAttribute('href');
  const gen = document.querySelector('meta[name="generator"]');
  if (gen) out.generator = gen.getAttribute('content');
  document.querySelectorAll('meta[property^="og:"]').forEach((m) => {
    const p = m.getAttribute('property'); const c = m.getAttribute('content');
    if (p && c) out.ogTags[p] = c;
  });
  document.querySelectorAll('meta[name^="twitter:"]').forEach((m) => {
    const n = m.getAttribute('name'); const c = m.getAttribute('content');
    if (n && c) out.twitterTags[n] = c;
  });
  document.querySelectorAll('img').forEach((img) => {
    if (!img.alt || !img.alt.trim()) out.imagesMissingAlt++;
  });
  const ldNodes = document.querySelectorAll('script[type="application/ld+json"]');
  out.hasStructuredData = ldNodes.length > 0;
  ldNodes.forEach((s) => {
    try {
      const parsed = JSON.parse(s.textContent || '');
      const items = Array.isArray(parsed) ? parsed : [parsed];
      items.forEach((it) => { if (it && it['@type']) out.structuredDataTypes.push(String(it['@type'])); });
    } catch {}
  });
  const seen = new Set();
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href'); if (!href) return;
    let abs;
    try { abs = new URL(href, location.href).toString(); } catch { return; }
    if (seen.has(abs)) return;
    seen.add(abs);
    if (abs.startsWith(${JSON.stringify(rootOrigin)})) out.internalLinks.push(abs);
    else if (abs.startsWith('http')) out.externalLinks.push(abs);
  });
  return out;
})();
`;

async function fetchTextSafe(
  url: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, { signal, redirect: "follow" });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

/** Pull every <loc>…</loc> URL out of a sitemap (or sitemap-index) XML body. */
function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) locs.push(m[1].trim());
  }
  return locs;
}

/** Read robots.txt and return any `Sitemap:` directive URLs (case-insensitive). */
async function sitemapsFromRobots(rootOrigin: string): Promise<string[]> {
  const r = await fetchTextSafe(new URL("/robots.txt", rootOrigin).toString());
  if (!r.ok || !r.text) return [];
  const out: string[] = [];
  for (const line of r.text.split(/\r?\n/)) {
    const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
    if (m && m[1]) out.push(m[1].trim());
  }
  return out;
}

/**
 * Discover page URLs for the crawl queue. The sitemap is the most reliable list
 * of a site's pages — so seeding from it makes depth robust even when
 * client-side nav never renders links. We look in two places, in priority
 * order: the `Sitemap:` directive(s) in robots.txt (where sites point to
 * non-standard sitemap paths), then the conventional /sitemap.xml. Each
 * candidate is expanded one level if it's a sitemap-index.
 */
async function discoverFromSitemap(
  rootOrigin: string,
  max: number,
): Promise<{ found: boolean; urls: string[] }> {
  // Candidate sitemap URLs, robots.txt first then the conventional location.
  const robotsSitemaps = await sitemapsFromRobots(rootOrigin);
  const candidates = Array.from(
    new Set([...robotsSitemaps, new URL("/sitemap.xml", rootOrigin).toString()]),
  );

  const pageUrls: string[] = [];
  let found = false;
  for (const candidate of candidates) {
    if (pageUrls.length >= max) break;
    const res = await fetchTextSafe(candidate);
    if (!res.ok || !res.text) continue;
    found = true;
    let locs = extractLocs(res.text);
    // Sitemap index → its <loc>s are child sitemaps. Expand a few of them.
    const childSitemaps = locs.filter((l) => /\.xml(\?|$)/i.test(l));
    if (childSitemaps.length > 0 && childSitemaps.length === locs.length) {
      const expanded: string[] = [];
      for (const sm of childSitemaps.slice(0, 5)) {
        const r = await fetchTextSafe(sm);
        if (r.ok) expanded.push(...extractLocs(r.text));
        if (expanded.length >= max) break;
      }
      locs = expanded;
    }
    pageUrls.push(...locs.filter((l) => l.startsWith(rootOrigin)));
  }

  return { found, urls: Array.from(new Set(pageUrls)).slice(0, max) };
}

function detectFramework(html: string, generator: string | null): string | null {
  if (generator?.toLowerCase().includes("next")) return "next.js";
  if (html.includes('id="__next"') || html.includes("/_next/")) return "next.js";
  if (html.includes("/_nuxt/")) return "nuxt";
  if (html.includes("data-react-helmet") || html.includes("React.createElement"))
    return "react";
  if (html.includes("Astro")) return "astro";
  return null;
}

export const crawlPlugin: Plugin = {
  name: "crawl",
  register(server) {
    server.tool(
      MCP_TOOLS.CRAWL_SITE,
      "Crawl a website (same origin) up to N pages. Returns metadata, structured-data types, internal/external link graph, and basic SEO signals per page.",
      {
        url: z.string().url(),
        maxPages: z.number().int().positive().max(60).default(30),
        sameOriginOnly: z.boolean().default(true),
      },
      async ({ url, maxPages, sameOriginOnly }) => {
        const rootUrl = new URL(url);
        const rootOrigin = rootUrl.origin;
        let browser: Browser | null = null;
        try {
          browser = await chromium.launch({ headless: true });
          const context = await browser.newContext({
            userAgent: "GrowthEngineerBot/0.1 (+https://growth-engineer.local)",
            viewport: { width: 1280, height: 800 },
          });
          const page = await context.newPage();
          const queue: string[] = [rootUrl.toString()];
          const visited = new Set<string>();
          const pages: CrawledPage[] = [];

          // P0: seed the queue from sitemap.xml so Syntra discovers /docs,
          // /pricing, /blog, etc. without depending on nav links rendering.
          const sitemap = await discoverFromSitemap(rootOrigin, maxPages);
          for (const u of sitemap.urls) {
            if (u !== queue[0] && !queue.includes(u)) queue.push(u);
          }
          logger.info("crawl_seeded", {
            rootOrigin,
            sitemapFound: sitemap.found,
            seededUrls: sitemap.urls.length,
          });

          while (queue.length > 0 && pages.length < maxPages) {
            const next = queue.shift();
            if (!next || visited.has(next)) continue;
            visited.add(next);
            try {
              const resp = await page.goto(next, {
                waitUntil: "domcontentloaded",
                timeout: 30_000,
              });
              // P1: let client-rendered nav (React / Next / Vue / Nuxt /
              // Angular) hydrate so its <a href> links exist before we extract
              // them. Bounded + best-effort — never fail a page on a slow idle.
              await page
                .waitForLoadState("networkidle", { timeout: 6_000 })
                .catch(() => {});
              const status = resp?.status() ?? 0;
              const meta = (await page.evaluate(
                META_EXTRACTOR(rootOrigin),
              )) as ExtractedMeta;
              pages.push({
                url: next,
                status,
                title: meta.title,
                description: meta.description,
                canonical: meta.canonical,
                ogTags: meta.ogTags,
                twitterTags: meta.twitterTags,
                h1Count: meta.h1Count,
                h2Count: meta.h2Count,
                imagesMissingAlt: meta.imagesMissingAlt,
                hasStructuredData: meta.hasStructuredData,
                structuredDataTypes: meta.structuredDataTypes,
                internalLinks: meta.internalLinks.slice(0, 100),
                externalLinks: meta.externalLinks.slice(0, 50),
                wordCount: meta.wordCount,
              });
              for (const link of meta.internalLinks) {
                if (!visited.has(link) && pages.length + queue.length < maxPages) {
                  if (!sameOriginOnly || link.startsWith(rootOrigin)) {
                    queue.push(link);
                  }
                }
              }
            } catch (err) {
              logger.warn("crawl_page_failed", {
                url: next,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }

          const [robotsRes, rootRes] = await Promise.all([
            fetchTextSafe(new URL("/robots.txt", rootOrigin).toString()),
            fetchTextSafe(rootUrl.toString()),
          ]);

          const generator =
            (pages[0]?.ogTags?.["og:generator"] as string | undefined) ?? null;
          const framework = detectFramework(rootRes.text, generator);

          const output: CrawlSiteOutput = {
            rootUrl: rootUrl.toString(),
            pages,
            sitemapFound: sitemap.found,
            robotsFound: robotsRes.ok,
            framework,
          };
          logger.info("crawl_done", {
            rootUrl: rootUrl.toString(),
            pages: pages.length,
            sitemapFound: sitemap.found,
            robotsFound: robotsRes.ok,
            framework,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("crawl_failed", { url, error: msg });
          return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          };
        } finally {
          if (browser) await browser.close();
        }
      },
    );
  },
};
