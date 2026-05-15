import type { Plugin } from "./types.js";
import { repoPlugin } from "./repo.plugin.js";
import { fsPlugin } from "./fs.plugin.js";
import { shellPlugin } from "./shell.plugin.js";
import { lighthousePlugin } from "./lighthouse.plugin.js";
import { crawlPlugin } from "./crawl.plugin.js";
import { seoPlugin } from "./seo.plugin.js";
import { vercelPlugin } from "./vercel.plugin.js";
import { githubPlugin } from "./github.plugin.js";

/**
 * Static plugin list. Keeps load order deterministic and avoids dynamic-import
 * surprises with bundlers. Add new plugins here.
 */
export const plugins: Plugin[] = [
  repoPlugin,
  fsPlugin,
  shellPlugin,
  lighthousePlugin,
  crawlPlugin,
  seoPlugin,
  vercelPlugin,
  githubPlugin,
];
