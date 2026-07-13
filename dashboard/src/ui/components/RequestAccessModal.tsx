"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ModalPortal } from "./ModalPortal";
import "../../app/auth.css";

const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"] as const;

/**
 * "Join the Syntra alpha" — shown when an approved-pending user clicks Analyze.
 * Collects customer-discovery info (company / website / industry / team size /
 * use case), submits it, and then shows an "under review" state. If the user has
 * already requested, we open straight into that pending state.
 */
export function RequestAccessModal({
  defaultWebsite,
  alreadyRequested,
  onClose,
}: {
  defaultWebsite?: string;
  alreadyRequested?: boolean;
  onClose: () => void;
}) {
  const [submitted, setSubmitted] = useState(!!alreadyRequested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState(defaultWebsite ?? "");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState<string>(TEAM_SIZES[1]);
  const [useCase, setUseCase] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!company.trim() || !website.trim() || !industry.trim() || !useCase.trim()) {
      setError("Please fill in every field.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/access/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company, website, industry, teamSize, useCase }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Could not submit your request.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalPortal>
      <div
        className="auth-gate"
        role="dialog"
        aria-modal="true"
        aria-label="Join the Syntra alpha"
        onClick={onClose}
      >
        <div className="auth-gate-card req-card" onClick={(e) => e.stopPropagation()}>
          <button className="auth-gate-close" onClick={onClose} aria-label="Close" type="button">
            ×
          </button>
          <div className="auth-card-brand">
            <img className="auth-mark" src="/syntra-logo.png" alt="" width={256} height={181} />
            Syntra Alpha
          </div>

          {submitted ? (
            <>
              <h1 className="auth-title">Request received 🎉</h1>
              <p className="auth-sub">
                Thanks — you’re on the list. Alpha access is limited while we tune recommendation
                quality; we’ll review your request and unlock your account shortly.
              </p>
              <button className="req-submit" type="button" onClick={onClose}>
                Got it
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 className="auth-title">Join the Syntra alpha</h1>
              <p className="auth-sub">
                Access is currently invite-only while we improve recommendation quality. Tell us a
                little about you and we’ll get you in.
              </p>

              {error && <div className="auth-error">{error}</div>}

              <label className="req-label">Company</label>
              <input className="req-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." disabled={busy} />

              <label className="req-label">Website</label>
              <input className="req-input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.com" disabled={busy} />

              <label className="req-label">Industry</label>
              <input className="req-input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Marketing agency, SaaS, real estate…" disabled={busy} />

              <label className="req-label">Team size</label>
              <select className="req-input" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} disabled={busy}>
                {TEAM_SIZES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <label className="req-label">Why do you want to use Syntra?</label>
              <textarea className="req-input req-textarea" value={useCase} onChange={(e) => setUseCase(e.target.value)} rows={3} placeholder="What you're hoping it does for you…" disabled={busy} />

              <button className="req-submit" type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Request Access"}
              </button>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
