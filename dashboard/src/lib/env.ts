import { z } from "zod";

/**
 * Server-side environment. Validated once, then re-exported as `env`.
 * Throwing here is intentional — fail fast if the operator forgot a key.
 */
const schema = z.object({
  MCP_BASE_URL: z.string().url().default("http://localhost:3100"),
  MCP_BEARER_TOKEN: z.string().min(1).default("tok_local"),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Per-agent model overrides. Unset → the default in AGENTS (shared) wins.
  // Set e.g. ORCHESTRATOR_MODEL=claude-opus-4-7 to flip a single agent's model
  // without a code change. Resolved in lib/models.ts.
  ORCHESTRATOR_MODEL: z.string().optional(),
  ENRICHMENT_MODEL: z.string().optional(),
  BLUEPRINT_MODEL: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  SQLITE_PATH: z.string().default("./data/growth-engineer.db"),
  OMIUM_API_URL: z.string().optional(),
  OMIUM_API_KEY: z.string().optional(),
  OMIUM_PROJECT_ID: z.string().default("growth-engineer"),
  SECRETS_ENC_KEY: z.string().optional(),
  // --- Auth (Google sign-in + signed session cookies) ---
  // Base URL the app is served from — used to build the OAuth redirect URI.
  AUTH_URL: z.string().url().default("http://localhost:3000"),
  // HMAC key for signing session cookies. Optional in dev (a fixed dev key is
  // used with a warning); MUST be set to a strong random value in production.
  AUTH_SECRET: z.string().optional(),
  // Google OAuth client. Google sign-in is disabled until both are present.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // When "1"/"true", enables a dev-only login bypass (no Google needed) for
  // local testing. MUST be off in production.
  DEV_LOGIN: z.string().optional(),
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
  // Per-agent model overrides (null = use the AGENTS default). Keyed by AgentName.
  modelOverrides: {
    orchestrator: parsed.data.ORCHESTRATOR_MODEL ?? null,
    enrichment: parsed.data.ENRICHMENT_MODEL ?? null,
    blueprint: parsed.data.BLUEPRINT_MODEL ?? null,
  } as Partial<Record<string, string | null>>,
  tavilyKey: parsed.data.TAVILY_API_KEY ?? null,
  sqlitePath: parsed.data.SQLITE_PATH,
  omiumUrl: parsed.data.OMIUM_API_URL ?? null,
  omiumKey: parsed.data.OMIUM_API_KEY ?? null,
  omiumProjectId: parsed.data.OMIUM_PROJECT_ID,
  secretsEncKey: parsed.data.SECRETS_ENC_KEY ?? null,
  authUrl: parsed.data.AUTH_URL.replace(/\/$/, ""),
  authSecret: parsed.data.AUTH_SECRET ?? null,
  googleClientId: parsed.data.GOOGLE_CLIENT_ID ?? null,
  googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET ?? null,
  googleConfigured: Boolean(parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET),
  devLogin: parsed.data.DEV_LOGIN === "1" || parsed.data.DEV_LOGIN === "true",
} as const;
