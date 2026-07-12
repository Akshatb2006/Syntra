import type { AccessStatus, User, UsersRepoPort } from "@/core/ports/store.port";
import { getDb } from "./client";
import { newId } from "@/lib/id";

interface Row {
  id: string;
  email: string;
  name: string;
  image: string | null;
  company: string | null;
  website: string | null;
  role: string | null;
  onboarded: number;
  access_status: string | null;
  industry: string | null;
  team_size: string | null;
  use_case: string | null;
  requested_at: number | null;
  access_updated_at: number | null;
  created_at: number;
}

function toUser(row: Row): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    company: row.company,
    website: row.website,
    role: row.role,
    onboarded: row.onboarded === 1,
    accessStatus: (row.access_status as AccessStatus | null) ?? "pending",
    industry: row.industry,
    teamSize: row.team_size,
    useCase: row.use_case,
    requestedAt: row.requested_at,
    accessUpdatedAt: row.access_updated_at,
    createdAt: row.created_at,
  };
}

export const usersRepo: UsersRepoPort = {
  upsertByEmail({ email, name, image }) {
    const normEmail = email.trim().toLowerCase();
    const existing = this.getByEmail(normEmail);
    if (existing) {
      // Refresh display name/avatar from the latest Google profile; never touch
      // onboarding state.
      getDb()
        .prepare("UPDATE users SET name = ?, image = ? WHERE id = ?")
        .run(name || existing.name, image, existing.id);
      return { ...existing, name: name || existing.name, image };
    }
    const user: User = {
      id: newId("usr"),
      email: normEmail,
      name: name || normEmail,
      image,
      company: null,
      website: null,
      role: null,
      onboarded: false,
      accessStatus: "pending",
      industry: null,
      teamSize: null,
      useCase: null,
      requestedAt: null,
      accessUpdatedAt: null,
      createdAt: Date.now(),
    };
    getDb()
      .prepare(
        `INSERT INTO users (id, email, name, image, company, website, role, onboarded, created_at)
         VALUES (@id, @email, @name, @image, NULL, NULL, NULL, 0, @createdAt)`,
      )
      .run({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
      });
    return user;
  },
  get(id) {
    const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
    return row ? toUser(row) : undefined;
  },
  getByEmail(email) {
    const row = getDb()
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.trim().toLowerCase()) as Row | undefined;
    return row ? toUser(row) : undefined;
  },
  setOnboarding(id, { company, website, role }) {
    getDb()
      .prepare(
        "UPDATE users SET company = ?, website = ?, role = ?, onboarded = 1 WHERE id = ?",
      )
      .run(company, website ?? null, role, id);
  },
  setAccessRequest(id, { company, website, industry, teamSize, useCase }) {
    getDb()
      .prepare(
        `UPDATE users SET company = ?, website = ?, industry = ?, team_size = ?, use_case = ?,
           requested_at = ? WHERE id = ?`,
      )
      .run(company, website, industry, teamSize, useCase, Date.now(), id);
  },
  setAccessStatus(id, status) {
    getDb()
      .prepare("UPDATE users SET access_status = ?, access_updated_at = ? WHERE id = ?")
      .run(status, Date.now(), id);
  },
  listAccessRequests() {
    const rows = getDb()
      .prepare(
        "SELECT * FROM users WHERE requested_at IS NOT NULL ORDER BY requested_at DESC",
      )
      .all() as Row[];
    return rows.map(toUser);
  },
};
