"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SignInPromptModal } from "./SignInPromptModal";

/**
 * The value-first entry point: paste a URL, get an audit. No GitHub, no
 * credentials — it creates an audit-only run and drops the user straight onto
 * the live results page. Credentials are only asked for later, when they
 * choose to implement a fix.
 *
 * Auth is deferred: signed-out visitors can browse the whole landing and only
 * hit sign-in when they click Analyze. We carry the intended URL through the
 * OAuth round-trip (via a `pending_audit` cookie set by /api/auth/login), so
 * after sign-in + onboarding the audit resumes automatically here.
 */
export function HeroAuditForm({
  authed = false,
  pendingAudit = null,
}: {
  authed?: boolean;
  pendingAudit?: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(pendingAudit ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When set, the "sign in with Google to run your audit" modal is shown for
  // this URL (signed-out visitors who clicked Analyze).
  const [signInFor, setSignInFor] = useState<string | null>(null);

  function normalize(raw: string): string | null {
    let s = raw.trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    try {
      const u = new URL(s);
      if (!u.hostname.includes(".")) return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  // Send an unauthenticated visitor into Google sign-in, stashing the site they
  // want audited so we can resume it when they return.
  function toSignIn(siteUrl: string) {
    window.location.href = `/api/auth/login?audit=${encodeURIComponent(siteUrl)}`;
  }

  const startAudit = useCallback(
    async (siteUrl: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            input: { siteUrl, trigger: { kind: "manual", userId: "self" } },
          }),
        });
        if (res.status === 401) {
          // Session lapsed between page load and submit — go (re)authenticate.
          toSignIn(siteUrl);
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not start the audit");
        router.push(`/runs/${json.run.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    },
    [router],
  );

  async function analyze(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const siteUrl = normalize(url);
    if (!siteUrl) {
      setError("Enter a valid website URL, e.g. yourcompany.com");
      return;
    }
    if (!authed) {
      // Not signed in yet — surface the branded sign-in modal for this URL.
      setSignInFor(siteUrl);
      return;
    }
    await startAudit(siteUrl);
  }

  // Resume: a visitor who clicked Analyze while signed out has now signed in and
  // onboarded, landing back here with their URL in `pending_audit`. Clear the
  // cookie (so a refresh doesn't re-fire) and start the audit automatically.
  useEffect(() => {
    if (!pendingAudit) return;
    document.cookie = "pending_audit=; Max-Age=0; path=/";
    const siteUrl = normalize(pendingAudit);
    if (siteUrl) void startAudit(siteUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAudit]);

  return (
    <form className="hero-audit" onSubmit={analyze}>
      <div className="hero-audit-row">
        <input
          className="hero-audit-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="yourcompany.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          aria-label="Website URL"
        />
        <button className="lp-btn lp-btn-primary" type="submit" disabled={busy}>
          {busy ? "Starting…" : "Analyze my site"}
          {!busy && <span className="ext">→</span>}
        </button>
      </div>
      {error ? (
        <div className="hero-audit-error">{error}</div>
      ) : (
        <div className="hero-audit-note">
          {authed
            ? "Paste your URL — a real audit in a couple of minutes."
            : "Paste your URL — sign in and we’ll run a real audit in minutes."}
        </div>
      )}
      {signInFor && (
        <SignInPromptModal siteUrl={signInFor} onClose={() => setSignInFor(null)} />
      )}
    </form>
  );
}
