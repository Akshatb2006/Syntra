"use client";
import { useState } from "react";

export interface AccessReq {
  id: string;
  email: string;
  name: string;
  company: string | null;
  website: string | null;
  industry: string | null;
  teamSize: string | null;
  useCase: string | null;
  accessStatus: string;
  requestedAt: number | null;
}

const FILTERS = ["pending", "approved", "rejected"] as const;

export function AdminRequests({ initial }: { initial: AccessReq[] }) {
  const [rows, setRows] = useState<AccessReq[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");

  async function act(uid: string, action: "approve" | "reject") {
    setBusy(uid);
    try {
      const res = await fetch(`/api/admin/requests/${uid}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const status = action === "approve" ? "approved" : "rejected";
        setRows((prev) => prev.map((r) => (r.id === uid ? { ...r, accessStatus: status } : r)));
      }
    } finally {
      setBusy(null);
    }
  }

  const counts = {
    pending: rows.filter((r) => r.accessStatus === "pending").length,
    approved: rows.filter((r) => r.accessStatus === "approved").length,
    rejected: rows.filter((r) => r.accessStatus === "rejected").length,
  };
  const visible = rows.filter((r) => r.accessStatus === filter);

  return (
    <>
      <div className="admin-tabs">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`admin-tab${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)} <span className="admin-count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="admin-empty">No {filter} requests.</div>
      ) : (
        <div className="admin-list">
          {visible.map((r) => (
            <div className="admin-card" key={r.id}>
              <div className="admin-card-main">
                <div className="admin-card-top">
                  <span className="admin-name">{r.name || r.email}</span>
                  <span className={`admin-badge ${r.accessStatus}`}>{r.accessStatus}</span>
                </div>
                <div className="admin-meta">
                  <span>{r.email}</span>
                  {r.company && <span>· {r.company}</span>}
                  {r.website && <span>· {r.website}</span>}
                  {r.industry && <span>· {r.industry}</span>}
                  {r.teamSize && <span>· {r.teamSize}</span>}
                </div>
                {r.useCase && <p className="admin-usecase">“{r.useCase}”</p>}
              </div>
              {r.accessStatus === "pending" && (
                <div className="admin-actions">
                  <button
                    className="admin-btn approve"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, "approve")}
                  >
                    {busy === r.id ? "…" : "Approve"}
                  </button>
                  <button
                    className="admin-btn reject"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
