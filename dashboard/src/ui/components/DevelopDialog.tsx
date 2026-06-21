"use client";
import { useEffect, useState } from "react";
import type { Suggestion } from "@growth/shared/types";

interface Props {
  runId: string;
  suggestion: Suggestion | null;
  /** True when the run has no repo/credentials yet — show the inline connect. */
  needsConnect: boolean;
  /** True on the trial plan — execution is gated, show the upgrade instead. */
  locked: boolean;
  onClose: () => void;
  onDispatched?: (suggestionId: string) => void;
}

/**
 * Generate-a-PR dialog. For an audit-only run, the user has already seen the
 * value (the issue + the fix) — so this is where we earn the right to ask for
 * GitHub access. Connect + dispatch happen in one action: paste a token + repo,
 * Syntra saves the credential, attaches it to the run, and opens the PR.
 */
export function DevelopDialog({ runId, suggestion, needsConnect, locked, onClose, onDispatched }: Props) {
  const [prompt, setPrompt] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestion) {
      setPrompt("");
      setGithubToken("");
      setRepoUrl("");
      setError(null);
      setBusy(false);
      setStage(null);
    }
  }, [suggestion]);

  if (!suggestion) return null;

  function validRepo(u: string): boolean {
    return /github\.com[:/][\w.-]+\/[\w.-]+/.test(u.trim());
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (prompt.trim()) body.prompt = prompt.trim();

      if (needsConnect) {
        if (!githubToken.trim())
          throw new Error("Paste a GitHub token so Syntra can open the PR.");
        if (!validRepo(repoUrl))
          throw new Error("Enter the repo URL, e.g. https://github.com/owner/repo");

        setStage("Connecting GitHub…");
        const credRes = await fetch("/api/credentials", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ githubToken: githubToken.trim() }),
        });
        const credJson = (await credRes.json().catch(() => ({}))) as {
          credentialsRef?: string;
          error?: string;
        };
        if (!credRes.ok || !credJson.credentialsRef)
          throw new Error(credJson.error ?? "Could not save credentials");
        body.credentialsRef = credJson.credentialsRef;
        body.repoUrl = repoUrl.trim();
      }

      setStage(needsConnect ? "Cloning repo & opening PR…" : "Opening pull request…");
      const res = await fetch(
        `/api/runs/${runId}/suggestions/${suggestion!.id}/dispatch`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onDispatched?.(suggestion!.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.35)", padding: 16,
      }}
      onClick={busy ? undefined : onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 540,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <div className="label" style={{ marginBottom: 6 }}>Generate pull request</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>
            {suggestion.title}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            {suggestion.description}
          </div>
        </div>

        {/* Body — locked (trial): show what they're buying, never hide it */}
        {locked ? (
          <div style={{ padding: "20px 24px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-strong)",
                background: "var(--accent-soft, #ecfdf5)",
                border: "1px solid #bbf7d0",
                borderRadius: 999,
                padding: "4px 11px",
                marginBottom: 14,
              }}
            >
              🔒 Available on paid plans
            </div>
            <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 16 }}>
              Your audit, business profile, and every recommendation stay open on the
              trial. <strong style={{ color: "var(--fg)" }}>Implementation</strong> — turning
              this fix into a real pull request — is where Pro begins.
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>
              Pro unlocks
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.8 }}>
              <li>Autonomous pull requests — Claude Code implements each fix</li>
              <li>Connected repositories &amp; deployments</li>
              <li>Before/after Lighthouse validation on every PR</li>
              <li>Continuous monitoring &amp; re-audits on each deploy</li>
            </ul>
          </div>
        ) : (
        <div style={{ padding: "20px 24px" }}>
          {needsConnect && (
            <div
              style={{
                background: "var(--accent-soft, #ecfdf5)",
                border: "1px solid #bbf7d0",
                borderRadius: 9,
                padding: "12px 14px",
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Connect GitHub to open this fix
              </div>
              <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                Syntra found the issue and knows the fix. To ship it, connect the repo —
                the token is used only to push a branch and open the PR. Never to merge.
              </div>
            </div>
          )}

          {needsConnect && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 18 }}>
              <div className="form-field">
                <label className="form-label">GitHub token</label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  disabled={busy}
                  className="form-input"
                  placeholder="ghp_… or github_pat_…"
                />
                <div className="form-hint">
                  Classic or fine-grained PAT with repo + workflow scopes.
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">GitHub repo URL</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={busy}
                  className="form-input"
                  placeholder="https://github.com/owner/repo"
                />
              </div>
            </div>
          )}

          <div className="form-field">
            <label className="form-label">
              Additional instruction <span style={{ color: "var(--fg-dim)", fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={busy}
              className="form-input"
              style={{ resize: "vertical", fontFamily: "inherit" }}
              placeholder="e.g. Reuse the existing schema component, don't touch the layout…"
            />
          </div>

          {error && (
            <div style={{
              background: "var(--danger-soft)", border: "1px solid #fecdd3",
              borderRadius: 7, padding: "10px 14px",
              fontSize: 12.5, color: "var(--danger)", marginTop: 14,
            }}>
              {error}
            </div>
          )}
        </div>
        )}

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          {locked ? (
            <>
              <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                You&apos;re on the Trial — analysis is unlimited.
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={onClose}>Maybe later</button>
                <button className="btn btn-primary" onClick={onClose}>Upgrade to Pro</button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                {busy && stage ? stage : "Opens a PR on a feature branch — never merges."}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
                <button className="btn btn-primary" onClick={generate} disabled={busy}>
                  {busy ? "Working…" : needsConnect ? "Connect & generate PR" : "Generate PR"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
