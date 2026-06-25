import type { Suggestion } from "@growth/shared/types";

export interface PromptInput {
  runId: string;
  jobId: string;
  user: string;
  suggestion: Suggestion;
  repoFullName: string;
  branchName: string;
  baseBranch: string;
  priorPrompts: string[];
  isRefinement: boolean;
}

export function buildCodeEditPrompt(p: PromptInput): string {
  const suggestionJson = JSON.stringify(p.suggestion, null, 2);
  const geoBlock = p.suggestion.geoContext
    ? JSON.stringify(p.suggestion.geoContext, null, 2)
    : "(no geo context)";
  const priorBlock =
    p.priorPrompts.length > 0
      ? p.priorPrompts.map((s, i) => `  [${i + 1}] ${s}`).join("\n")
      : "(none)";
  const refinementBanner = p.isRefinement
    ? `\n=== REFINEMENT RUN ===\nA previous job already pushed work to "${p.branchName}" and likely opened a PR. Build on top of it. Do NOT redo existing work.\n`
    : "";

  return `You are being run HEADLESSLY to implement ONE SEO/growth improvement for a website. The site can be in ANY industry and built with ANY framework — discover what it is from the repo; do not assume. Work fully autonomously — do NOT ask questions, do NOT wait for confirmation. Make decisions and proceed.

RUN ID: ${p.runId}
JOB ID: ${p.jobId}
TRIGGERED BY: ${p.user}
REPO: ${p.repoFullName}
${refinementBanner}
SUGGESTION TO IMPLEMENT:
${suggestionJson}

LOCAL CONTEXT (area/landmark/keyword data — present only for location-based businesses; use it to shape page content, schema, and copy):
${geoBlock}

PRIOR USER INSTRUCTIONS for this job (oldest first — already acted on, included for continuity):
${priorBlock}

=== INSTRUCTIONS (follow exactly) ===

1. Quickly read the repo structure and identify the framework and routing convention it ACTUALLY uses (e.g. Next.js App Router src/app/, Next.js Pages Router src/pages/, Astro, SvelteKit, a static site, a plain HTML/CMS theme, etc.). Adapt every edit to whatever the repo really is — do NOT impose a Next.js structure on a non-Next.js repo.
2. Read any CLAUDE.md or README.md at the repo root for conventions.
3. Ensure you are on branch "${p.branchName}". If it doesn't exist locally, cut it from "${p.baseBranch}":
   git fetch origin
   git checkout ${p.baseBranch} && git pull origin ${p.baseBranch} --ff-only
   git checkout -b ${p.branchName}    (or: git checkout ${p.branchName} if it exists on origin and pull)
4. Implement the suggestion. STAY IN SCOPE — only this one suggestion. No refactors, no unrelated cleanups, no new dependencies unless strictly required by the change.
5. Common implementations — adapt these to the repo's actual framework (the Next.js specifics below are EXAMPLES, not requirements):
   - "metadata": update the page/route's metadata mechanism (e.g. Next.js generateMetadata()/export const metadata, an Astro frontmatter <title>/<meta>, or the template's <head>).
   - "schema": add a JSON-LD <script type="application/ld+json"> in the appropriate component, layout, or template head. Use schema.org types appropriate to this business.
   - "locality_page": ONLY when local context is provided — create a new local landing page using the repo's routing convention (e.g. Next.js src/app/locations/[slug]/page.tsx, or the equivalent).
   - "content_gap": create a new dedicated page (and internal links to it) for the entity named in the suggestion — the site already references it but has no page that owns the topic. Use the repo's routing convention, add relevant schema, and register it in the sitemap. Write genuine on-topic copy; do NOT fabricate facts/figures.
   - "internal_linking": add anchor links between related pages.
   - "image_optimization": use the framework's optimized image approach (e.g. next/image) or add proper width/height/lazy-loading to <img>.
   - "sitemap_robots": add a sitemap and robots file the way this framework expects (e.g. Next.js src/app/sitemap.ts + robots.ts, or public/sitemap.xml + public/robots.txt).
6. If a build script is present, run a quick syntax check with: npx tsc --noEmit  (best-effort; do not block on pre-existing errors).
7. Commit only the files you changed:
   git add <files>
   git commit -m "growth: <brief> (run ${p.runId.slice(0, 8)})"
8. Push: git push -u origin ${p.branchName}
9. Open or update a PR on GitHub:
   - If one exists for this branch, comment on it summarizing this commit (gh pr comment <n> --body "...").
   - Else open one: gh pr create --base ${p.baseBranch} --head ${p.branchName} --title "Growth: <brief>" --body "<summary, run ${p.runId}, category: ${p.suggestion.category}>"
10. Exit.

=== HARD RULES (never violate) ===
- NEVER push to ${p.baseBranch} or main. Only to ${p.branchName}.
- NEVER force-push.
- NEVER modify .env, secrets, tokens, or CI configs unrelated to this suggestion.
- NEVER delete migrations or rewrite history.
- NEVER use --no-verify.

=== SCOPE GUARDRAIL ===
If you find yourself touching more than 6 files for one suggestion, stop. The scope is wrong. Revert overreach and redo tighter.

=== IF BLOCKED ===
If the suggestion is unactionable from the codebase, write .growth-blocked-${p.jobId.slice(0, 8)}.md at the repo root explaining what's blocking you, commit it, push, and exit WITHOUT opening a PR.

Begin now.`;
}
