"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "@/ui/components/Card";
import { Field, Input } from "@/ui/components/Input";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";

interface StatusResponse {
  mcp: {
    url: string;
    reachable: boolean;
    error?: string;
    plugins?: string[];
    users?: number;
  };
  omium: { configured: boolean; projectId: string };
  anthropic: { configured: boolean };
  tavily: { configured: boolean };
}

const EMPTY_FORM = {
  githubToken: "",
  vercelToken: "",
  vercelProjectId: "",
  vercelTeamId: "",
  googlePlacesApiKey: "",
  googleAnalyticsPropertyId: "",
  searchConsoleSiteUrl: "",
};

export default function ConnectPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [credentialsRef, setCredentialsRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j: StatusResponse) => setStatus(j))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("credentialsRef");
    if (stored) setCredentialsRef(stored);
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Strip empty strings — backend treats them as missing optionals.
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v && String(v).trim()),
      );
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setCredentialsRef(json.credentialsRef);
      sessionStorage.setItem("credentialsRef", json.credentialsRef);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          The only thing required from you is a GitHub token — Claude needs it
          to push branches and open PRs on your repo. LLM and search are
          provided by the platform.
        </p>
      </div>

      <Card>
        <CardHeader>System status</CardHeader>
        <CardBody>
          {!status ? (
            <div className="text-sm text-[var(--fg-muted)]">Loading…</div>
          ) : (
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-[var(--fg-muted)]">MCP server</span>
                <span className="flex items-center gap-2">
                  {status.mcp.reachable ? (
                    <Badge tone="success">reachable</Badge>
                  ) : (
                    <Badge tone="danger">unreachable</Badge>
                  )}
                  <span className="font-mono text-xs text-[var(--fg-muted)]">
                    {status.mcp.url}
                  </span>
                </span>
              </li>
              {status.mcp.reachable && (
                <li className="flex items-center justify-between">
                  <span className="text-[var(--fg-muted)]">Plugins</span>
                  <span className="flex flex-wrap gap-1.5">
                    {(status.mcp.plugins ?? []).map((p) => (
                      <Badge key={p} tone="muted">
                        {p}
                      </Badge>
                    ))}
                  </span>
                </li>
              )}
              <li className="flex items-center justify-between">
                <span className="text-[var(--fg-muted)]">Anthropic LLM</span>
                <Badge tone={status.anthropic.configured ? "success" : "danger"}>
                  {status.anthropic.configured ? "ready" : "platform key missing"}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-[var(--fg-muted)]">Web search</span>
                <Badge tone={status.tavily.configured ? "success" : "muted"}>
                  {status.tavily.configured ? "ready" : "stub fallback"}
                </Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-[var(--fg-muted)]">Omium tracing</span>
                <Badge tone={status.omium.configured ? "success" : "muted"}>
                  {status.omium.configured ? "active" : "local-only"}
                </Badge>
              </li>
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Required</CardHeader>
        <CardBody className="space-y-4">
          {credentialsRef && (
            <div className="rounded-md bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300">
              Saved as{" "}
              <span className="font-mono">{credentialsRef}</span>. You can now
              start a run.
            </div>
          )}
          <Field
            label="GitHub token"
            hint="Classic PAT or fine-grained token with repo + workflow scopes on the target repo. Create at github.com/settings/tokens."
          >
            <Input
              type="password"
              value={form.githubToken}
              onChange={(e) => setForm({ ...form, githubToken: e.target.value })}
              placeholder="ghp_… or github_pat_…"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Vercel (recommended)</CardHeader>
        <CardBody className="space-y-4">
          <p className="text-xs text-[var(--fg-muted)]">
            Required if you want the Validation agent to wait for the PR&apos;s
            preview deployment and re-run Lighthouse against it. Without these,
            the run still produces a PR; you just won&apos;t get the before/after
            score in the dashboard.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vercel token" hint="vercel.com/account/tokens">
              <Input
                type="password"
                value={form.vercelToken}
                onChange={(e) =>
                  setForm({ ...form, vercelToken: e.target.value })
                }
              />
            </Field>
            <Field
              label="Vercel project ID"
              hint="vercel.com/<team>/<project>/settings — the prj_… ID"
            >
              <Input
                value={form.vercelProjectId}
                onChange={(e) =>
                  setForm({ ...form, vercelProjectId: e.target.value })
                }
                placeholder="prj_…"
              />
            </Field>
            <Field
              label="Vercel team ID"
              hint="Only if the project is in a team; team_…"
            >
              <Input
                value={form.vercelTeamId}
                onChange={(e) =>
                  setForm({ ...form, vercelTeamId: e.target.value })
                }
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Optional analytics</CardHeader>
        <CardBody className="space-y-4">
          <p className="text-xs text-[var(--fg-muted)]">
            Captured for future integrations — not used by the v1 pipeline.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Google Places API key"
              hint="For accurate nearby-landmark discovery"
            >
              <Input
                type="password"
                value={form.googlePlacesApiKey}
                onChange={(e) =>
                  setForm({ ...form, googlePlacesApiKey: e.target.value })
                }
              />
            </Field>
            <Field label="GA4 property ID">
              <Input
                value={form.googleAnalyticsPropertyId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    googleAnalyticsPropertyId: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Search Console site URL">
              <Input
                value={form.searchConsoleSiteUrl}
                onChange={(e) =>
                  setForm({ ...form, searchConsoleSiteUrl: e.target.value })
                }
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {error && <div className="text-sm text-rose-400">{error}</div>}
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy || !form.githubToken}>
          {busy ? "Saving…" : "Save credentials"}
        </Button>
      </div>
    </div>
  );
}
