import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { isAdmin } from "@/lib/auth/admin";
import { sqliteStore } from "@/infra/store/sqlite";
import { AdminRequests } from "@/ui/components/AdminRequests";
import "./admin.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Alpha access · Syntra admin" };

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/");
  // Don't confirm the page exists to non-admins.
  if (!isAdmin(session.email)) redirect("/");

  const requests = sqliteStore.users.listAccessRequests().map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    company: u.company,
    website: u.website,
    industry: u.industry,
    teamSize: u.teamSize,
    useCase: u.useCase,
    accessStatus: u.accessStatus,
    requestedAt: u.requestedAt,
  }));

  return (
    <div className="admin-shell">
      <div className="admin-head">
        <h1>Alpha access requests</h1>
        <p>Approve the people whose feedback you want. Approving unlocks audits (and emails them if email is configured).</p>
      </div>
      <AdminRequests initial={requests} />
    </div>
  );
}
