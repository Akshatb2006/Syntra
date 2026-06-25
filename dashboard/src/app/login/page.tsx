import { env } from "@/lib/env";
import "../auth.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · Syntra" };

const ERRORS: Record<string, string> = {
  google_unconfigured:
    "Google sign-in isn’t configured yet. The admin needs to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  oauth_state: "Your sign-in expired or didn’t verify. Please try again.",
  oauth_failed: "Google sign-in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-split">
      {/* LEFT — brand panel */}
      <aside className="auth-brand-panel">
        <div className="auth-brand">
          <span className="auth-mark">S</span>
          Syntra
        </div>

        <div>
          <span className="auth-eyebrow">
            <span className="dot" />
            Detect → Plan → Implement → Validate
          </span>
          <div className="auth-head">
            <h2>
              The autonomous SEO engineer that <em>ships real changes</em>.
            </h2>
            <p>
              Sign in to point Syntra at your site. It crawls, finds the
              highest-impact gaps with evidence, and shows you exactly what to build
              — in a couple of minutes.
            </p>
          </div>
          <ul className="auth-points">
            <li>
              <span className="tick">✓</span> Evidence-backed audits, not generic tips
            </li>
            <li>
              <span className="tick">✓</span> Knows demand &amp; competitors, not just keywords
            </li>
            <li>
              <span className="tick">✓</span> Adapts to any industry, any site
            </li>
          </ul>
        </div>

        <div className="auth-foot">© Syntra · Built for operators who like to watch agents work.</div>
      </aside>

      {/* RIGHT — sign-in card */}
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card-brand">
            <span className="auth-mark">S</span>
            Syntra
          </div>

          <h1 className="auth-title">Sign in to Syntra</h1>
          <p className="auth-sub">Run an AI SEO audit on your site in a couple of minutes.</p>

          {error && <div className="auth-error">{ERRORS[error] ?? "Something went wrong. Please try again."}</div>}

          <a className="auth-google" href="/api/auth/login">
            <GoogleMark />
            Continue with Google
          </a>

          {env.devLogin && (
            <a className="auth-dev" href="/api/auth/dev?email=dev@syntra.local&name=Dev+User">
              Dev login (local testing only)
            </a>
          )}

          <p className="auth-fine">
            We only use your Google email to identify your account. By continuing you agree to use
            the Syntra trial responsibly.
          </p>
        </div>
      </main>
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
