import { redirect } from "next/navigation";
import { getSession, setSession } from "@/lib/auth/server";
import { getAccess } from "@/lib/auth/access";
import { sqliteStore } from "@/infra/store/sqlite";
import { logger } from "@/lib/logger";
import "./onboarding.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Request access · Syntra" };

const ROLES = [
  { name: "Founder", icon: "👤" },
  { name: "Agency", icon: "🏢" },
  { name: "Marketing", icon: "📣" },
  { name: "SEO", icon: "🔍" },
  { name: "Developer", icon: "💻" },
  { name: "Other", icon: "✨" },
] as const;

const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"] as const;

/**
 * Sign-up, in one step.
 *
 * Because the alpha is invite-only, asking someone to sign in and *then* fill in
 * a separate access request is two walls in a row. So for anyone who isn't
 * already approved, this — the mandatory post-Google onboarding step — IS the
 * access request: one form, then "we'll email you when you're in".
 *
 * Users who are already approved (and admins) just get the short version, since
 * they have nothing to request.
 */
async function save(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/");
  const access = await getAccess();
  const mustRequest = access.kind !== "approved";

  const company = String(formData.get("company") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const teamSize = String(formData.get("teamSize") ?? "").trim();
  const useCase = String(formData.get("useCase") ?? "").trim();

  if (!company || !role) redirect("/onboarding?error=1");
  if (mustRequest && (!website || !industry || !teamSize || !useCase)) {
    redirect("/onboarding?error=1");
  }

  sqliteStore.users.setOnboarding(session.uid, {
    company,
    role,
    website: website || null,
  });

  // Same submit doubles as the alpha-access request. Status stays `pending`
  // until an admin approves in /admin; approval emails the user.
  if (mustRequest) {
    sqliteStore.users.setAccessRequest(session.uid, {
      company,
      website,
      industry,
      teamSize,
      useCase,
    });
    logger.info("access_requested", { uid: session.uid, email: session.email, company });
  }

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
  const access = await getAccess();
  const mustRequest = access.kind !== "approved";
  const { error } = await searchParams;
  const first = session.name ? session.name.split(" ")[0] : "";

  return (
    <div className="onb-screen">
      {/* Ambient branded backdrop — teal aurora + drifting orbs + faint grid. */}
      <div className="onb-aurora" aria-hidden />
      <div className="onb-grid" aria-hidden />
      <span className="onb-orb onb-orb-1" aria-hidden />
      <span className="onb-orb onb-orb-2" aria-hidden />

      <form action={save} className="onb-card">
        <div className="onb-brand">
          <img className="onb-mark" src="/syntra-logo.png" alt="" width={256} height={181} />
          <span>Syntra</span>
        </div>

        <h1 className="onb-title">
          Welcome{first ? `, ${first}` : ""} <span className="onb-wave">👋</span>
        </h1>
        <p className="onb-sub">
          {mustRequest
            ? "Syntra is in invite-only alpha. Tell us about your site — that’s the whole request. We’ll email you the moment you’re approved."
            : "One quick step, then we’ll run your audit."}
        </p>

        {error && (
          <div className="onb-error" role="alert">
            {mustRequest
              ? "Please fill in every field so we can review your request."
              : "Please add your company and pick what best describes you."}
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

        {mustRequest && (
          <>
            <label className="onb-label" htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              required
              autoComplete="url"
              inputMode="url"
              placeholder="acme.com"
              className="onb-input"
            />

            <label className="onb-label" htmlFor="industry">Industry</label>
            <input
              id="industry"
              name="industry"
              required
              placeholder="Marketing agency, SaaS, real estate…"
              className="onb-input"
            />

            <label className="onb-label" htmlFor="teamSize">Team size</label>
            <select id="teamSize" name="teamSize" required className="onb-input" defaultValue={TEAM_SIZES[1]}>
              {TEAM_SIZES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <label className="onb-label" htmlFor="useCase">
              What are you hoping Syntra does for you?
            </label>
            <textarea
              id="useCase"
              name="useCase"
              required
              rows={3}
              placeholder="Rank for the searches our customers actually make…"
              className="onb-input onb-textarea"
            />
          </>
        )}

        <button type="submit" className="onb-submit">
          {mustRequest ? "Request alpha access" : "Continue to audit"} <span aria-hidden>→</span>
        </button>

        {mustRequest && (
          <p className="onb-fine">
            No credit card. We review every request by hand and email you at {session.email}.
          </p>
        )}
      </form>
    </div>
  );
}
