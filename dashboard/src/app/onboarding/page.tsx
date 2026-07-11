import { redirect } from "next/navigation";
import { getSession, setSession } from "@/lib/auth/server";
import { sqliteStore } from "@/infra/store/sqlite";
import "./onboarding.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Welcome · Syntra" };

const ROLES = [
  { name: "Founder", icon: "👤" },
  { name: "Agency", icon: "🏢" },
  { name: "Marketing", icon: "📣" },
  { name: "SEO", icon: "🔍" },
  { name: "Developer", icon: "💻" },
  { name: "Other", icon: "✨" },
] as const;

async function saveOnboarding(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/");

  const company = String(formData.get("company") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!company || !role) {
    redirect("/onboarding?error=1");
  }

  // Website is captured at analysis time (the URL they paste to audit), so we
  // don't ask for it here.
  sqliteStore.users.setOnboarding(session.uid, { company, role });
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
  if (!session) redirect("/");
  const { error } = await searchParams;
  const first = session.name ? session.name.split(" ")[0] : "";

  return (
    <div className="onb-screen">
      {/* Ambient branded backdrop — teal aurora + drifting orbs + faint grid. */}
      <div className="onb-aurora" aria-hidden />
      <div className="onb-grid" aria-hidden />
      <span className="onb-orb onb-orb-1" aria-hidden />
      <span className="onb-orb onb-orb-2" aria-hidden />

      <form action={saveOnboarding} className="onb-card">
        <div className="onb-brand">
          <img className="onb-mark" src="/syntra-logo.png" alt="" />
          <span>Syntra</span>
        </div>

        <h1 className="onb-title">
          Welcome{first ? `, ${first}` : ""} <span className="onb-wave">👋</span>
        </h1>
        <p className="onb-sub">One quick step, then we’ll run your audit.</p>

        {error && (
          <div className="onb-error" role="alert">
            Please add your company and pick what best describes you.
          </div>
        )}

        <label className="onb-label" htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          required
          autoComplete="organization"
          placeholder="Acme Inc."
          className="onb-input"
        />

        <span className="onb-label onb-label-block">You are…</span>
        <div className="onb-roles">
          {ROLES.map((r, i) => (
            <label className="onb-role" key={r.name}>
              <input type="radio" name="role" value={r.name} required defaultChecked={i === 0} />
              <span className="onb-role-ico" aria-hidden>{r.icon}</span>
              <span className="onb-role-name">{r.name}</span>
              <span className="onb-role-check" aria-hidden>✓</span>
            </label>
          ))}
        </div>

        <button type="submit" className="onb-submit">
          Continue to audit <span aria-hidden>→</span>
        </button>
      </form>
    </div>
  );
}
