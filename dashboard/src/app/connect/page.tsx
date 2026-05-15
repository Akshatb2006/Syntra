"use client";
import { useEffect, useState } from "react";
import { Field, Input } from "@/ui/components/Input";
import { Button } from "@/ui/components/Button";
import Link from "next/link";

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

function StatusIndicator({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="status-row">
      <span className="status-row-label">{label}</span>
      <div className="status-row-value">
        {detail && <span className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{detail}</span>}
        <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>{ok ? 'ready' : 'not configured'}</span>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [credentialsRef, setCredentialsRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
    setSaved(false);
    try {
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
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell">
      {/* Header row */}
      <div className="section-head">
        <div>
          <h1 className="section-title">Connect</h1>
          <p className="section-sub">
            Provide a GitHub token so the pipeline can open PRs. LLM and search are platform-provided.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          <Button onClick={save} disabled={busy || !form.githubToken}>
            {busy ? "Saving…" : "Save credentials"}
          </Button>
        </div>
      </div>

      {/* Success banner */}
      {saved && (
        <div style={{
          background: 'var(--success-soft)',
          border: '1px solid #bbf7d0',
          borderRadius: 10,
          padding: '16px 20px',
          fontSize: 14,
          color: 'var(--success)',
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>Credentials saved as <span className="mono">{credentialsRef}</span></span>
          <Link href="/runs/new"><button className="btn btn-primary">Start a run →</button></Link>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 24, padding: '12px 16px', background: 'var(--danger-soft)', borderRadius: 8 }}>{error}</div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>

        {/* LEFT COLUMN — Credentials */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* GitHub token */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 14 }}>Required</div>
            <div className="sug-card">
              <Field
                label="GitHub token"
                hint="Classic PAT or fine-grained token with repo + workflow scopes. Create at github.com/settings/tokens."
              >
                <Input
                  type="password"
                  value={form.githubToken}
                  onChange={(e) => setForm({ ...form, githubToken: e.target.value })}
                  placeholder="ghp_… or github_pat_…"
                />
              </Field>
            </div>
          </div>

          {/* Vercel */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 14 }}>
              Vercel <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--fg-dim)', fontSize: 12 }}>— before/after Lighthouse</span>
            </div>
            <div className="sug-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Field label="Vercel token" hint="vercel.com/account/tokens">
                  <Input
                    type="password"
                    value={form.vercelToken}
                    onChange={(e) => setForm({ ...form, vercelToken: e.target.value })}
                  />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Vercel project ID" hint="prj_… from settings">
                    <Input
                      value={form.vercelProjectId}
                      onChange={(e) => setForm({ ...form, vercelProjectId: e.target.value })}
                      placeholder="prj_…"
                    />
                  </Field>
                  <Field label="Vercel team ID" hint="team_… if applicable">
                    <Input
                      value={form.vercelTeamId}
                      onChange={(e) => setForm({ ...form, vercelTeamId: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — System status + optional */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* System status */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 14 }}>System status</div>
            <div className="sug-card" style={{ padding: '4px 24px' }}>
              {!status ? (
                <div className="status-row"><span style={{ color: 'var(--fg-muted)' }}>Loading…</span></div>
              ) : (
                <>
                  <div className="status-row">
                    <span className="status-row-label">MCP server</span>
                    <div className="status-row-value">
                      <span className="mono" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{status.mcp.url}</span>
                      <span className={`badge ${status.mcp.reachable ? 'badge-success' : 'badge-danger'}`}>
                        {status.mcp.reachable ? 'reachable' : 'unreachable'}
                      </span>
                    </div>
                  </div>
                  {status.mcp.reachable && status.mcp.plugins && status.mcp.plugins.length > 0 && (
                    <div className="status-row">
                      <span className="status-row-label">Plugins</span>
                      <div className="status-row-value">
                        {status.mcp.plugins.map(p => (
                          <span key={p} className="badge badge-muted">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <StatusIndicator ok={status.anthropic.configured} label="Anthropic LLM" />
                  <StatusIndicator ok={status.tavily.configured} label="Web search (Tavily)" detail={status.tavily.configured ? '' : 'stub fallback active'} />
                  <StatusIndicator ok={status.omium.configured} label="Omium tracing" detail={status.omium.configured ? status.omium.projectId : 'local-only'} />
                </>
              )}
            </div>
          </div>

          {/* Optional analytics */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 14 }}>Optional analytics</div>
            <div className="sug-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Field label="Google Places API key" hint="Accurate nearby-landmark discovery">
                  <Input
                    type="password"
                    value={form.googlePlacesApiKey}
                    onChange={(e) => setForm({ ...form, googlePlacesApiKey: e.target.value })}
                  />
                </Field>
                <Field label="GA4 property ID">
                  <Input
                    value={form.googleAnalyticsPropertyId}
                    onChange={(e) => setForm({ ...form, googleAnalyticsPropertyId: e.target.value })}
                  />
                </Field>
                <Field label="Search Console site URL">
                  <Input
                    value={form.searchConsoleSiteUrl}
                    onChange={(e) => setForm({ ...form, searchConsoleSiteUrl: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
