"use client";
import { useEffect } from "react";
import "../../app/auth.css";

/**
 * The "sign in to run your audit" modal. Shown when a signed-out visitor clicks
 * Analyze — instead of bouncing them straight to Google, we surface a branded
 * card (same look as the old dashboard gate). "Continue with Google" carries the
 * site they wanted audited (via /api/auth/login?audit=…) so the audit resumes
 * after sign-in + onboarding.
 */
export function SignInPromptModal({
  siteUrl,
  onClose,
}: {
  siteUrl: string;
  onClose: () => void;
}) {
  let host = siteUrl;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    /* keep raw */
  }
  const loginHref = `/api/auth/login?audit=${encodeURIComponent(siteUrl)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="auth-gate"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to run your audit"
      onClick={onClose}
    >
      <div className="auth-gate-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-gate-close" onClick={onClose} aria-label="Close" type="button">
          ×
        </button>
        <div className="auth-card-brand">
          <img className="auth-mark" src="/syntra-logo.png" alt="" width={256} height={181} />
          Syntra
        </div>

        <h1 className="auth-title">Sign in to run your audit</h1>
        <p className="auth-sub">
          We’ll audit <strong>{host}</strong> and surface real SEO opportunities — free, no
          credit card. Continue with Google to start.
        </p>

        <a className="auth-google" href={loginHref}>
          <GoogleMark />
          Continue with Google
        </a>

        <p className="auth-fine">
          We only use your Google email to identify your account.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
