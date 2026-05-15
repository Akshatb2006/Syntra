import "dotenv/config";
import { z } from "zod";
import { resolve } from "node:path";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3100),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_DIR: z.string().default("./logs"),
  WORKSPACE_ROOT: z.string().default("./workspaces"),

  VALID_TOKENS: z.string().default(""),

  CLAUDE_BIN: z.string().default("claude"),
  DISPATCH_TIMEOUT_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),

  GITHUB_WEBHOOK_SECRET: z.string().default(""),
  VERCEL_WEBHOOK_SECRET: z.string().default(""),

  GITHUB_TOKEN: z.string().default(""),
  PUBLIC_BASE_URL: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("[config] Invalid environment:", parsed.error.flatten());
  process.exit(1);
}

const env = parsed.data;

function parseTokenMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const [token, username] = trimmed.split(":");
    if (token && username) map.set(token.trim(), username.trim());
  }
  return map;
}

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  logDir: resolve(env.LOG_DIR),
  workspaceRoot: resolve(env.WORKSPACE_ROOT),
  validTokens: parseTokenMap(env.VALID_TOKENS),
  claudeBin: env.CLAUDE_BIN,
  dispatchTimeoutMs: env.DISPATCH_TIMEOUT_MS,
  githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET,
  vercelWebhookSecret: env.VERCEL_WEBHOOK_SECRET,
  defaultGithubToken: env.GITHUB_TOKEN || null,
  publicBaseUrl: env.PUBLIC_BASE_URL || null,
} as const;

if (config.validTokens.size === 0) {
  console.warn(
    "[config] VALID_TOKENS is empty. No clients will be able to authenticate.",
  );
}
