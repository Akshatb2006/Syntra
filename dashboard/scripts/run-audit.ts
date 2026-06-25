/**
 * Standalone live-audit runner. Drives the real createRun pipeline against a URL
 * and prints the Site Understanding output (page types, entities, content gaps)
 * plus the resulting suggestions. For manual verification only.
 *
 * Usage: node@22 --env-file=dashboard/.env --import tsx dashboard/scripts/run-audit.ts <url>
 */
import { createRun } from "@/orchestration/pipeline";
import { sqliteStore } from "@/infra/store/sqlite";

const url = process.argv[2] ?? "https://www.compass.com";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\n▶ Auditing ${url}\n`);
  const run = await createRun({
    siteUrl: url,
    branchBase: "main",
    trigger: { kind: "manual", userId: "verify-script" },
  });

  const terminal = new Set(["awaiting_dispatch", "completed", "failed"]);
  const deadline = Date.now() + 15 * 60_000;
  let status = run.status;
  let lastBeat = Date.now();
  while (!terminal.has(status) && Date.now() < deadline) {
    await sleep(2000);
    const cur = sqliteStore.runs.get(run.id);
    if (!cur) continue;
    if (cur.status !== status) {
      status = cur.status;
      console.log(`  · ${status}`);
      lastBeat = Date.now();
    } else if (Date.now() - lastBeat > 30_000) {
      // Heartbeat so a long planning phase looks alive, not hung.
      const latest = sqliteStore.steps.byRun(run.id).slice(-1)[0];
      console.log(`  · still ${status} (latest step: ${latest?.agent}/${latest?.status})`);
      lastBeat = Date.now();
    }
  }

  const finalRun = sqliteStore.runs.get(run.id);
  console.log(`\n=== RUN ${run.id} → ${finalRun?.status} (engine ${finalRun?.engineVersion}, detector ${finalRun?.detectorVersion}) ===`);
  if (finalRun?.error) console.log("ERROR:", finalRun.error.message);

  const steps = sqliteStore.steps.byRun(run.id);
  const crawl = steps.find((s) => s.agent === "crawl_seo");
  const su = steps.find((s) => s.agent === "site_understanding");
  const out = (crawl?.output ?? {}) as any;

  console.log(`\n--- Site Understanding step: ${su?.status ?? "(none)"} ---`);
  console.log(`pagesCrawled: ${out.pagesCrawled}`);
  console.log(`businessProfile:`, out.businessProfile);
  console.log(`\nPAGE TYPES:`);
  for (const p of out.pageTypes ?? []) console.log(`  ${p.type}: ${p.count}`);

  const u = out.understanding ?? {};
  console.log(`\nclassification mode: ${u.mode}`);
  console.log(`taxonomy: ${(u.taxonomy ?? []).join(", ")}`);

  console.log(`\nENTITIES (${(u.entities ?? []).length}):`);
  for (const e of u.entities ?? [])
    console.log(`  ${e.name}  [${e.kind}]  ×${e.mentions} across ${e.pages} pages  (${e.ownership}${e.coverageDepth ? `/${e.coverageDepth}` : ""})`);

  console.log(`\nCONTENT GAPS (${(u.contentGaps ?? []).length}):`);
  for (const g of u.contentGaps ?? [])
    console.log(`  ${g.mode.toUpperCase()} ${g.entity} [${g.kind}] — ${g.mentions}× / ${g.pageCount} pages${g.ownerPage ? ` @ ${g.ownerPage}` : ""} → ${g.samplePages.join(", ")}`);

  const sugs = sqliteStore.suggestions.byRun(run.id);
  console.log(`\n=== SUGGESTIONS (${sugs.length}) ===`);
  for (const s of sugs.sort((a, b) => b.priorityScore - a.priorityScore)) {
    console.log(`\n[${s.category}] ${s.title}  (priority ${Math.round(s.priorityScore)}, conf ${s.confidence})`);
    if (s.opportunity) {
      const o = s.opportunity;
      console.log(
        `  opportunity: impact ${o.impact} · demand ${o.demand} · compGap ${o.competitiveGap} · effort ${o.effort} → priority ${o.priority}`,
      );
    }
    console.log(`  issue: ${s.issue}`);
    if (s.demand)
      console.log(
        `  demand: ${s.demand.band} ${s.demand.score}/100 [${s.demand.intent}]${s.demand.competitorsOwning.length ? ` — competitors own: ${s.demand.competitorsOwning.join(", ")}` : ""}`,
      );
    if (s.whyItMatters) console.log(`  why: ${s.whyItMatters}`);
  }
  console.log();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
