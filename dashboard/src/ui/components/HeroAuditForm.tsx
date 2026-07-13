"use client";
import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * The audit entry point, shown only to approved alpha users: paste a URL, get an
 * audit. No GitHub, no credentials — it creates an audit-only run and drops the
 * user straight onto the live results page. Credentials are only asked for
 * later, when they choose to implement a fix.
 *
 * Signed-out and not-yet-approved visitors never see this — the hero shows them
 * the alpha-access CTA instead (see `getAccess()` and the landing page).
 */
export function HeroAuditForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // The session lapsed, or access was revoked, since this page rendered.
        // Re-render the hero from the server: it'll show sign-in or the access
        // state that now applies, instead of a form that can't submit.
        if (res.status === 401 || res.status === 403) {
          router.refresh();
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
    await startAudit(siteUrl);
  }

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
          Paste your URL — a real audit in a couple of minutes.
        </div>
      )}
    </form>
  );
}
