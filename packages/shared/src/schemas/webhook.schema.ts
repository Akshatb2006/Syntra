import { z } from "zod";

export const githubPushSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  repository: z.object({
    full_name: z.string(),
    clone_url: z.string(),
    default_branch: z.string(),
  }),
  pusher: z.object({ name: z.string(), email: z.string() }),
  commits: z
    .array(
      z.object({
        id: z.string(),
        message: z.string(),
        modified: z.array(z.string()).default([]),
        added: z.array(z.string()).default([]),
        removed: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export const vercelDeploymentSchema = z.object({
  type: z.enum([
    "deployment.succeeded",
    "deployment.error",
    "deployment.created",
  ]),
  payload: z.object({
    deployment: z.object({
      id: z.string(),
      url: z.string(),
      meta: z.record(z.string()).default({}),
    }),
    project: z.object({ id: z.string(), name: z.string() }),
    target: z.enum(["production", "staging"]).nullable(),
  }),
});
