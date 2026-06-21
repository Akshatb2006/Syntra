/**
 * Stubbed plan / entitlement gate.
 *
 * The AUDIT — crawl → business detection → site understanding → opportunities
 * → recommendations — is always available. That's the trial, and the demo.
 * EXECUTION — Generate PR / connect repo / implement / validate — is paid-only.
 * That's the product.
 *
 * This is a deliberate stub: no auth, no billing, no accounts yet. Flip the
 * plan with the NEXT_PUBLIC_SYNTRA_PLAN env var (trial | pro | enterprise) to
 * demo the unlocked path. Real entitlements land later, behind accounts +
 * billing — which we are intentionally NOT building during fundraising.
 */
export type Plan = "trial" | "pro" | "enterprise";

export function currentPlan(): Plan {
  const p = (process.env.NEXT_PUBLIC_SYNTRA_PLAN ?? "trial").toLowerCase();
  return p === "pro" || p === "enterprise" ? (p as Plan) : "trial";
}

/** Execution (PR generation, validation) is unlocked only on a paid plan. */
export function executionUnlocked(): boolean {
  return currentPlan() !== "trial";
}
