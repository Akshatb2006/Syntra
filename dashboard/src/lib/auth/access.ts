import { sqliteStore } from "@/infra/store/sqlite";
import { getSession } from "./server";
import { isAdmin } from "./admin";

/**
 * Where a visitor stands with the invite-only alpha. One read, used by every
 * server component that has to decide what to show:
 *
 *   signed_out    → nothing to run yet: the only CTA is "Request alpha access"
 *   needs_request → signed in but hasn't told us about themselves yet
 *   pending       → request submitted, waiting on an admin
 *   rejected      → admin declined
 *   approved      → the product: paste a URL, run audits, see your runs
 *
 * Read fresh from the DB on every request (never cached into the session
 * cookie), so the moment an admin approves someone, their next page load has
 * the full product — no re-login.
 */
export type AccessState =
  | { kind: "signed_out" }
  | { kind: "needs_request"; email: string; firstName: string }
  | { kind: "pending"; email: string; firstName: string }
  | { kind: "rejected"; email: string; firstName: string }
  | { kind: "approved"; email: string; firstName: string; admin: boolean };

export type AccessKind = AccessState["kind"];

function firstNameOf(name: string): string {
  return name ? name.split(" ")[0]! : "";
}

export async function getAccess(): Promise<AccessState> {
  const session = await getSession();
  if (!session) return { kind: "signed_out" };

  const { email } = session;
  const firstName = firstNameOf(session.name);
  const admin = isAdmin(email);
  const user = sqliteStore.users.get(session.uid);

  if (admin || user?.accessStatus === "approved") {
    return { kind: "approved", email, firstName, admin };
  }
  if (user?.accessStatus === "rejected") return { kind: "rejected", email, firstName };
  if (user?.requestedAt) return { kind: "pending", email, firstName };
  return { kind: "needs_request", email, firstName };
}

/** Approved users (and admins) are the only ones who can run or see audits. */
export function canRun(state: AccessState): boolean {
  return state.kind === "approved";
}
