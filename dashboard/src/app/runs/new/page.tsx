"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody } from "@/ui/components/Card";
import { Field, Input } from "@/ui/components/Input";
import { Button } from "@/ui/components/Button";

export default function NewRunPage() {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branchBase, setBranchBase] = useState("main");
  const [city, setCity] = useState("");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New run</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          The pipeline will crawl, audit, research locality intent, plan,
          dispatch Claude Code, and validate the preview — autonomously.
        </p>
      </div>

      {!credentialsRef && (
        <Card>
          <CardBody>
            <div className="text-sm text-rose-400">
              You haven&apos;t saved credentials yet.{" "}
              <Link href="/connect" className="underline">
                Connect them
              </Link>{" "}
              before starting a run.
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>Target</CardHeader>
        <CardBody className="space-y-4">
          <Field label="Site URL" hint="Public URL of the live site to audit.">
            <Input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://yoursite.com"
            />
          </Field>
          <Field label="GitHub repo URL" hint="HTTPS clone URL of the Next.js codebase.">
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Base branch">
              <Input
                value={branchBase}
                onChange={(e) => setBranchBase(e.target.value)}
              />
            </Field>
            <Field
              label="Primary city (optional)"
              hint="Seeds the Geo agent. Leave blank to auto-detect from the URL."
            >
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Mumbai, Bangalore, NYC, …"
              />
            </Field>
          </div>
          {error && <div className="text-sm text-rose-400">{error}</div>}
          <div className="flex justify-end">
            <Button onClick={start} disabled={busy || !credentialsRef}>
              {busy ? "Starting…" : "Start autonomous run"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
