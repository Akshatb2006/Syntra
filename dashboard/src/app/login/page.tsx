import { env } from "@/lib/env";

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 22,
            fontWeight: 600,
            fontSize: 17,
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--accent)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
            }}
          >
            S
          </span>
          Syntra
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 650, margin: "0 0 6px" }}>Sign in to Syntra</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 13.5, margin: "0 0 24px", lineHeight: 1.5 }}>
          Run an AI SEO audit on your site in a couple of minutes.
        </p>

        {error && (
          <div
            style={{
              background: "var(--danger-soft, rgba(220,50,50,.08))",
              color: "var(--danger)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12.5,
              lineHeight: 1.5,
              marginBottom: 18,
              textAlign: "left",
            }}
          >
            {ERRORS[error] ?? "Something went wrong. Please try again."}
          </div>
        )}

        <a
          href="/api/auth/login"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid var(--border-2, var(--border))",
            background: "var(--surface-2, #fff)",
            color: "var(--fg)",
            fontSize: 14.5,
            fontWeight: 550,
            textDecoration: "none",
          }}
        >
          <GoogleMark />
          Continue with Google
        </a>

        {env.devLogin && (
          <a
            href="/api/auth/dev?email=dev@syntra.local&name=Dev+User"
            style={{
              display: "block",
              marginTop: 12,
              fontSize: 12,
              color: "var(--fg-muted)",
              textDecoration: "underline",
            }}
          >
            Dev login (local testing only)
          </a>
        )}

        <p style={{ color: "var(--fg-dim, var(--fg-muted))", fontSize: 11.5, margin: "22px 0 0", lineHeight: 1.5 }}>
          We only use your Google email to identify your account. By continuing you agree to use
          the Syntra trial responsibly.
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
