import { redirect } from "next/navigation";
import { getSession, setSession } from "@/lib/auth/server";
import { sqliteStore } from "@/infra/store/sqlite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Welcome · Syntra" };

const ROLES = ["Founder", "Agency", "Marketing", "SEO", "Developer", "Other"] as const;

async function saveOnboarding(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/login");

  const company = String(formData.get("company") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!company || !website || !role) {
    redirect("/onboarding?error=1");
  }

  sqliteStore.users.setOnboarding(session.uid, { company, website, role });
  // Re-issue the session cookie so middleware sees onboarding as complete.
  await setSession({ uid: session.uid, email: session.email, name: session.name, onb: true });
  redirect("/");
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
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
      <form
        action={saveOnboarding}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "32px 30px",
        }}
      >
        <h1 style={{ fontSize: 21, fontWeight: 650, margin: "0 0 4px" }}>
          Welcome{session.name ? `, ${session.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: 13.5, margin: "0 0 22px", lineHeight: 1.5 }}>
          A couple of quick questions, then you’re into the dashboard.
        </p>

        {error && (
          <div
            style={{
              color: "var(--danger)",
              fontSize: 12.5,
              marginBottom: 16,
            }}
          >
            Please fill in your company, website, and pick what best describes you.
          </div>
        )}

        <label style={labelStyle}>Company name</label>
        <input name="company" required placeholder="Acme Inc." style={inputStyle} />

        <label style={labelStyle}>Website</label>
        <input name="website" required type="text" inputMode="url" placeholder="acme.com" style={inputStyle} />

        <label style={{ ...labelStyle, marginBottom: 10 }}>What best describes you?</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {ROLES.map((r, i) => (
            <label
              key={r}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 9,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              <input type="radio" name="role" value={r} required defaultChecked={i === 0} />
              {r}
            </label>
          ))}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Continue to dashboard →
        </button>
      </form>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 550,
  color: "var(--fg-muted)",
  margin: "0 0 6px",
} as const;

const inputStyle = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 9,
  border: "1px solid var(--border)",
  background: "var(--surface-2, #fff)",
  color: "var(--fg)",
  fontSize: 14,
  marginBottom: 18,
  boxSizing: "border-box" as const,
};
