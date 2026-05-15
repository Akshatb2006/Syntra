import { z } from "zod";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { logger } from "../lib/logger.js";
import type { Plugin } from "./types.js";
import { MCP_TOOLS } from "@growth/shared/constants";
import type { LighthouseRunOutput } from "@growth/shared/types";

function score(audit: number | null | undefined): number {
  if (typeof audit !== "number") return 0;
  return Math.round(audit * 100);
}

export const lighthousePlugin: Plugin = {
  name: "lighthouse",
  register(server) {
    server.tool(
      MCP_TOOLS.LIGHTHOUSE_RUN,
      "Run Lighthouse against a URL. Returns performance/accessibility/best-practices/seo scores plus failing audits.",
      {
        url: z.string().url(),
        formFactor: z.enum(["mobile", "desktop"]).default("mobile"),
        onlyCategories: z
          .array(z.enum(["performance", "accessibility", "best-practices", "seo"]))
          .optional(),
      },
      async ({ url, formFactor, onlyCategories }) => {
        let chrome: chromeLauncher.LaunchedChrome | null = null;
        try {
          chrome = await chromeLauncher.launch({
            chromeFlags: [
              "--headless=new",
              "--no-sandbox",
              "--disable-gpu",
              "--disable-dev-shm-usage",
            ],
          });
          const options = {
            port: chrome.port,
            output: "json" as const,
            logLevel: "error" as const,
            onlyCategories: onlyCategories ?? [
              "performance",
              "accessibility",
              "best-practices",
              "seo",
            ],
            formFactor,
            screenEmulation:
              formFactor === "desktop"
                ? {
                    mobile: false,
                    width: 1350,
                    height: 940,
                    deviceScaleFactor: 1,
                    disabled: false,
                  }
                : undefined,
          };
          const result = await lighthouse(url, options);
          if (!result?.lhr) throw new Error("Lighthouse returned no result");
          const lhr = result.lhr;
          const diagnostics = Object.values(lhr.audits)
            .filter((a) => a.score !== null && a.score !== undefined && a.score < 0.9)
            .map((a) => ({
              id: a.id,
              title: a.title,
              description: a.description,
              score: a.score,
              scoreDisplayMode: a.scoreDisplayMode,
              numericValue: (a as { numericValue?: number }).numericValue,
              displayValue: (a as { displayValue?: string }).displayValue,
            }))
            .slice(0, 50);

          const output: LighthouseRunOutput = {
            url,
            fetchedAt: Date.now(),
            scores: {
              performance: score(lhr.categories.performance?.score),
              accessibility: score(lhr.categories.accessibility?.score),
              bestPractices: score(lhr.categories["best-practices"]?.score),
              seo: score(lhr.categories.seo?.score),
            },
            diagnostics,
          };
          logger.info("lighthouse_done", {
            url,
            scores: output.scores,
            diagnostics: diagnostics.length,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("lighthouse_failed", { url, error: msg });
          return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          };
        } finally {
          if (chrome) await chrome.kill();
        }
      },
    );
  },
};
