"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/ui/components/Input";
import { Button } from "@/ui/components/Button";

export default function NewRunPage() {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branchBase, setBranchBase] = useState("main");
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [locationBased, setLocationBased] = useState<"auto" | "yes" | "no">("auto");
  const [credentialsRef, setCredentialsRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCredentialsRef(sessionStorage.getItem("credentialsRef"));
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      if (!credentialsRef) throw new Error("Connect credentials first.");
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          credentialsRef,
          input: {
            siteUrl,
            repoUrl,
            branchBase,
            ...(city.trim() ? { city: city.trim() } : {}),
            ...(industry.trim() || locationBased !== "auto"
              ? {
                  businessProfileHint: {
                    ...(industry.trim() ? { industry: industry.trim() } : {}),
                    ...(locationBased !== "auto"
                      ? { locationBased: locationBased === "yes" }
                      : {}),
                  },
                }
              : {}),
            trigger: { kind: "manual", userId: "local-user" },
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      router.push(`/runs/${json.run.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canStart = !!credentialsRef && !!siteUrl && !!repoUrl;

  return (
    <div className="page-shell">
      <div className="section-head" style={{ marginBottom: 36 }}>
        <div>
          <h1 className="section-title">New run</h1>
          <p className="section-sub">
            The pipeline will crawl, audit, detect the business type, research
            intent, plan, dispatch Claude Code, and validate the preview —
            autonomously, for any industry.
          </p>
        </div>
      </div>

      {!credentialsRef && (
        <div style={{
          background: 'var(--danger-soft)',
          border: '1px solid #fecdd3',
          borderRadius: 10,
          padding: '16px 20px',
          fontSize: 14,
          color: 'var(--danger)',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>You haven&apos;t saved credentials yet.</span>
          <Link href="/connect"><button className="btn btn-secondary">Connect →</button></Link>
        </div>
      )}

      {credentialsRef && (
        <div style={{
          background: 'var(--success-soft)',
          border: '1px solid #bbf7d0',
          borderRadius: 10,
          padding: '14px 20px',
          fontSize: 13,
          color: 'var(--success)',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span>●</span>
          <span>Credentials ready · <span className="mono">{credentialsRef}</span></span>
        </div>
      )}

      <div className="sug-card">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 20 }}>Target</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Field label="Site URL" hint="Public URL of the live site to audit.">
              <Input
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://yoursite.com"
              />
            </Field>
            <Field label="GitHub repo URL" hint="HTTPS clone URL of the site's codebase.">
              <Input
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Field
                label="Industry (optional)"
                hint="Leave blank to auto-detect from the crawl."
              >
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="SaaS, Healthcare, Real Estate, …"
                />
              </Field>
              <Field
                label="Location-based?"
                hint="Does it serve specific places? Drives local SEO."
              >
                <select
                  className="form-input"
                  value={locationBased}
                  onChange={(e) => setLocationBased(e.target.value as "auto" | "yes" | "no")}
                >
                  <option value="auto">Auto-detect</option>
                  <option value="yes">Yes — local business</option>
                  <option value="no">No — online / global</option>
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Field label="Base branch">
                <Input
                  value={branchBase}
                  onChange={(e) => setBranchBase(e.target.value)}
                />
              </Field>
              <Field
                label="Primary city (optional)"
                hint="Only used for location-based sites. Blank = auto-detect."
              >
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mumbai, Austin TX, …"
                />
              </Field>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 18, padding: '12px 16px', background: 'var(--danger-soft)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
            This will open a real PR on your repo. Ensure credentials are correct.
          </p>
          <Button
            onClick={start}
            disabled={busy || !canStart}
          >
            {busy ? "Starting…" : "Start autonomous run"}
          </Button>
        </div>
      </div>
    </div>
  );
}
