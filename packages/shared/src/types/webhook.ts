export type WebhookSource = "github" | "vercel";

export interface GithubPushPayload {
  ref: string;
  before: string;
  after: string;
  repository: { full_name: string; clone_url: string; default_branch: string };
  pusher: { name: string; email: string };
  commits: Array<{ id: string; message: string; modified: string[]; added: string[]; removed: string[] }>;
}

export interface VercelDeploymentPayload {
  type: "deployment.succeeded" | "deployment.error" | "deployment.created";
  payload: {
    deployment: { id: string; url: string; meta: Record<string, string> };
    project: { id: string; name: string };
    target: "production" | "staging" | null;
  };
}

export interface NormalizedWebhookEvent {
  source: WebhookSource;
  deliveryId: string;
  eventType: string;
  receivedAt: number;
  raw: unknown;
}
