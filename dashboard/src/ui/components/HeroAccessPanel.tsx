"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequestAccessModal } from "./RequestAccessModal";
import type { AccessKind } from "@/lib/auth/access";

/**
 * What a not-yet-approved visitor sees where approved users see the URL box.
 *
 * The alpha is invite-only, so there is no point showing an "Analyze my site"
 * field to someone who can't run one yet. Instead:
 *
 *   signed_out    → "Request alpha access" → Google sign-in → the request form
 *                   is the sign-up (see /onboarding), so it's one step, not two.
 *   needs_request → signed in but never told us about themselves (an account
 *                   from before the request form existed) → open it here.
 *   pending       → "We'll email you the moment you're in."
 *   rejected      → said no, gently.
 *
 * The moment an admin approves them, the landing re-renders into the real
 * product — URL box, Recent runs, My runs.
 */
export function HeroAccessPanel({ state, email }: { state: AccessKind; email: string }) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);

  // Closing the request modal re-renders the hero from the server, so a
  // just-submitted request flips straight into the "in review" card.
  function closeRequest() {
    setRequesting(false);
    router.refresh();
  }

  if (state === "signed_out") {
    return (
      <div className="hero-access">
        <a className="lp-btn lp-btn-primary hero-access-btn" href="/api/auth/login">
          Request alpha access <span className="ext">→</span>
        </a>
        <div className="hero-audit-note">
          Invite-only while we tune recommendation quality. Sign in with Google, tell us about
          your site, and we’ll email you when you’re in.
        </div>
      </div>
    );
  }

  if (state === "needs_request") {
    return (
      <div className="hero-access">
        <button
          className="lp-btn lp-btn-primary hero-access-btn"
          type="button"
          onClick={() => setRequesting(true)}
        >
          Request alpha access <span className="ext">→</span>
        </button>
        <div className="hero-audit-note">
          Tell us a little about your site and we’ll email you when your account is approved.
        </div>
        {requesting && <RequestAccessModal alreadyRequested={false} onClose={closeRequest} />}
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="hero-access">
        <div className="hero-access-card">
          <span className="ha-badge">
            <span className="ha-dot pulse-soft" />
            On the waitlist
          </span>
          <h3 className="ha-title">Your request is in review</h3>
          <p className="ha-sub">
            Alpha access is limited while we tune recommendation quality. We’ll email{" "}
            <strong>{email}</strong> the moment you’re approved — then your audit box appears
            right here.
          </p>
        </div>
      </div>
    );
  }

  // rejected
  return (
    <div className="hero-access">
      <div className="hero-access-card">
        <span className="ha-badge ha-badge-muted">Not this round</span>
        <h3 className="ha-title">We couldn’t fit you into this alpha</h3>
        <p className="ha-sub">
          We’re keeping the group small while the agent is still learning. We’ve kept your
          details and will reach out at <strong>{email}</strong> when we widen access.
        </p>
      </div>
    </div>
  );
}
