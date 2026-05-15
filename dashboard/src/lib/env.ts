import { z } from "zod";

/**
 * Server-side environment. Validated once, then re-exported as `env`.
 * Throwing here is intentional — fail fast if the operator forgot a key.
 */
const schema = z.object({
  MCP_BASE_URL: z.string().url().default("http://localhost:3100"),
  MCP_BEARER_TOKEN: z.string().min(1).default("tok_local"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ORCHESTRATOR_MODEL: z.string().default("claude-opus-4-7"),
  WORKER_MODEL: z.string().default("claude-sonnet-4-6"),
  TAVILY_API_KEY: z.string().optional(),
  SQLITE_PATH: z.string().default("./data/growth-engineer.db"),
  OMIUM_API_URL: z.string().optional(),
  OMIUM_API_KEY: z.string().optional(),
  OMIUM_PROJECT_ID: z.string().default("growth-engineer"),
  SECRETS_ENC_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("[env] invalid environment", parsed.error.flatten());
  throw new Error("Invalid environment");
}

export const env = {
  mcpBaseUrl: parsed.data.MCP_BASE_URL,
  mcpBearer: parsed.data.MCP_BEARER_TOKEN,
  anthropicKey: parsed.data.ANTHROPIC_API_KEY ?? null,
  orchestratorModel: parsed.data.ORCHESTRATOR_MODEL,
  workerModel: parsed.data.WORKER_MODEL,
  tavilyKey: parsed.data.TAVILY_API_KEY ?? null,
  sqlitePath: parsed.data.SQLITE_PATH,
  omiumUrl: parsed.data.OMIUM_API_URL ?? null,
  omiumKey: parsed.data.OMIUM_API_KEY ?? null,
  omiumProjectId: parsed.data.OMIUM_PROJECT_ID,
  secretsEncKey: parsed.data.SECRETS_ENC_KEY ?? null,
} as const;
