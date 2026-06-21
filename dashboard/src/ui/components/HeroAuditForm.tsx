"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * The value-first entry point: paste a URL, get an audit. No GitHub, no
 * credentials — it creates an audit-only run and drops the user straight onto
 * the live results page. Credentials are only asked for later, when they
 * choose to implement a fix.
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

  async function analyze(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const siteUrl = normalize(url);
    if (!siteUrl) {
      setError("Enter a valid website URL, e.g. yourcompany.com");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { siteUrl, trigger: { kind: "manual", userId: "anon" } },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start the audit");
      router.push(`/runs/${json.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
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
          No signup, no GitHub — just your URL. A real audit in a couple of minutes.
        </div>
      )}
    </form>
  );
}
