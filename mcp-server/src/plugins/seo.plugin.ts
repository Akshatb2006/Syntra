import { z } from "zod";
import type { Plugin } from "./types.js";
import { MCP_TOOLS } from "@growth/shared/constants";

/**
 * Lightweight HTML-only SEO inspector. Useful when crawl is overkill — e.g. to
 * re-check a single page after a fix on the preview deployment.
 */

interface PageInspection {
  url: string;
  fetchStatus: number;
  signals: {
    titleLength: number | null;
    descriptionLength: number | null;
    canonical: string | null;
    hasOg: boolean;
    hasTwitter: boolean;
    h1Count: number;
    structuredDataTypes: string[];
    issues: string[];
    score: number;
  };
}

function score(signals: PageInspection["signals"]): number {
  let s = 100;
  for (const issue of signals.issues) {
    if (issue.startsWith("missing")) s -= 12;
    else if (issue.startsWith("too_short") || issue.startsWith("too_long")) s -= 6;
    else s -= 4;
  }
  return Math.max(0, s);
}

function inspect(url: string, html: string, status: number): PageInspection {
  const issues: string[] = [];
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const title = titleMatch?.[1]?.trim() ?? "";
  if (!title) issues.push("missing_title");
  else if (title.length < 20) issues.push("too_short_title");
  else if (title.length > 65) issues.push("too_long_title");

  const descMatch = /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i.exec(
    html,
  );
  const description = descMatch?.[1]?.trim() ?? "";
  if (!description) issues.push("missing_description");
  else if (description.length < 80) issues.push("too_short_description");
  else if (description.length > 165) issues.push("too_long_description");

  const canonicalMatch = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i.exec(
    html,
  );
  const canonical = canonicalMatch?.[1] ?? null;
  if (!canonical) issues.push("missing_canonical");

  const hasOg = /<meta\s+property=["']og:/i.test(html);
  if (!hasOg) issues.push("missing_og");

  const hasTwitter = /<meta\s+name=["']twitter:/i.test(html);
  if (!hasTwitter) issues.push("missing_twitter");

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1Count === 0) issues.push("missing_h1");
  if (h1Count > 1) issues.push("multiple_h1");

  const ldTypes: string[] = [];
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1] ?? "");
      const items = Array.isArray(json) ? json : [json];
      for (const it of items) {
        if (it && typeof it["@type"] === "string") ldTypes.push(it["@type"]);
        else if (it && Array.isArray(it["@type"]))
          ldTypes.push(...it["@type"].map(String));
      }
    } catch {
      issues.push("invalid_jsonld");
    }
  }
  if (ldTypes.length === 0) issues.push("missing_structured_data");

  const signals: PageInspection["signals"] = {
    titleLength: title ? title.length : null,
    descriptionLength: description ? description.length : null,
    canonical,
    hasOg,
    hasTwitter,
    h1Count,
    structuredDataTypes: ldTypes,
    issues,
    score: 0,
  };
  signals.score = score(signals);
  return { url, fetchStatus: status, signals };
}

export const seoPlugin: Plugin = {
  name: "seo",
  register(server) {
    server.tool(
      MCP_TOOLS.PARSE_PAGE_SEO,
      "Fetch a URL and produce a lightweight SEO signal report (title, meta, OG, canonical, JSON-LD, h1). Faster than full crawl for single-page checks.",
      { url: z.string().url() },
      async ({ url }) => {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "GrowthEngineerSEO/0.1" },
          });
          const html = await res.text();
          const out = inspect(url, html, res.status);
          return {
            content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
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
