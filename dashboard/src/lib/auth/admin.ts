import { env } from "@/lib/env";

/**
 * Admins (ADMIN_EMAILS) run the alpha: they see the approvals page, approve or
 * reject requests, and bypass the access gate + run cap. Case-insensitive.
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.adminEmails.has(email.trim().toLowerCase());
}
