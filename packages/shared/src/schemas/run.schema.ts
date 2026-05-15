import { z } from "zod";

export const runInputSchema = z.object({
  siteUrl: z.string().url(),
  repoUrl: z.string().url(),
  branchBase: z.string().min(1).default("main"),
  city: z.string().min(1).optional(),
  trigger: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("manual"), userId: z.string().min(1) }),
    z.object({
      kind: z.literal("github_webhook"),
      deliveryId: z.string(),
      commit: z.string(),
    }),
    z.object({ kind: z.literal("vercel_webhook"), deploymentId: z.string() }),
    z.object({ kind: z.literal("scheduled"), cron: z.string() }),
  ]),
});

export type RunInputDto = z.infer<typeof runInputSchema>;

export const createRunRequestSchema = z.object({
  input: runInputSchema,
  credentialsRef: z.string().min(1),
});

export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;

export const credentialsSchema = z.object({
  // Required — Claude Code uses this token to push branches and open PRs
  // on the user's repo.
  githubToken: z.string().min(1),
  // Optional — only needed if the user wants the Validation agent to
  // re-Lighthouse the Vercel preview deployment.
  vercelToken: z.string().optional(),
  vercelProjectId: z.string().optional(),
  vercelTeamId: z.string().optional(),
  // Optional future-facing integrations.
  googlePlacesApiKey: z.string().optional(),
  googleAnalyticsPropertyId: z.string().optional(),
  searchConsoleSiteUrl: z.string().optional(),
});

export type Credentials = z.infer<typeof credentialsSchema>;
