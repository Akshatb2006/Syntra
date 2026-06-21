import { z } from "zod";

const suggestionCategoryEnum = z.enum([
  "metadata",
  "schema",
  "internal_linking",
  "locality_page",
  "performance",
  "image_optimization",
  "content_quality",
  "accessibility",
  "structured_data",
  "sitemap_robots",
]);

export const suggestionSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  category: suggestionCategoryEnum,
  title: z.string().min(1),
  issue: z.string().default(""),
  evidence: z
    .array(
      z.object({
        source: z.enum(["crawl", "lighthouse", "geo"]),
        detail: z.string(),
        url: z.string().optional(),
        detectedAt: z.number().optional(),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1).default(1),
  description: z.string(),
  rationale: z.string(),
  implementation: z.string().default(""),
  expectedImpact: z.enum(["low", "medium", "high"]),
  risk: z.enum(["low", "medium", "high"]),
  priorityScore: z.number().min(0).max(100),
  targetFiles: z.array(z.string()).default([]),
  geoContext: z
    .object({
      locality: z.string(),
      city: z.string(),
      landmarks: z.array(z.string()),
      searchIntents: z.array(z.string()),
      keywordCluster: z.array(z.string()),
    })
    .optional(),
  status: z.enum([
    "proposed",
    "selected",
    "dispatched",
    "implemented",
    "validated",
    "rejected",
    "failed",
  ]),
  dispatchJobId: z.string().nullable().default(null),
  prNumber: z.number().nullable().default(null),
});

export const dispatchCodeEditRequestSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  suggestion: suggestionSchema,
  branchName: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9._\/-]+$/, "branchName must be a safe ref name"),
  baseBranch: z.string().min(1).default("main"),
  githubRepoFullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  traceContext: z.object({
    traceId: z.string().min(1),
    parentSpanId: z.string().nullable(),
  }),
  priorPrompts: z.array(z.string()).optional(),
  isRefinement: z.boolean().optional(),
});

export type DispatchCodeEditRequestDto = z.infer<
  typeof dispatchCodeEditRequestSchema
>;
