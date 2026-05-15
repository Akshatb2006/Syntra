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

  return `You are being run HEADLESSLY to implement ONE SEO/growth improvement for a real-estate Next.js website. Work fully autonomously — do NOT ask questions, do NOT wait for confirmation. Make decisions and proceed.

RUN ID: ${p.runId}
JOB ID: ${p.jobId}
TRIGGERED BY: ${p.user}
REPO: ${p.repoFullName}
${refinementBanner}
SUGGESTION TO IMPLEMENT:
${suggestionJson}

GEO CONTEXT (locality/landmark/keyword data — use it to shape page content, schema, and copy):
${geoBlock}

PRIOR USER INSTRUCTIONS for this job (oldest first — already acted on, included for continuity):
${priorBlock}

=== INSTRUCTIONS (follow exactly) ===

1. Quickly read the repo structure. Identify whether this is Next.js App Router (src/app/) or Pages Router (src/pages/). Adapt your edits.
2. Read any CLAUDE.md or README.md at the repo root for conventions.
3. Ensure you are on branch "${p.branchName}". If it doesn't exist locally, cut it from "${p.baseBranch}":
   git fetch origin
   git checkout ${p.baseBranch} && git pull origin ${p.baseBranch} --ff-only
   git checkout -b ${p.branchName}    (or: git checkout ${p.branchName} if it exists on origin and pull)
4. Implement the suggestion. STAY IN SCOPE — only this one suggestion. No refactors, no unrelated cleanups, no new dependencies unless strictly required by the change.
5. Common implementations:
   - "metadata": update generateMetadata() or export const metadata in the relevant route file.
   - "schema": add a JSON-LD <script type="application/ld+json"> in the appropriate component or layout.
   - "locality_page": create a new route under src/app/locations/[slug]/page.tsx (or equivalent) using the geo context provided.
   - "internal_linking": add anchor links between related pages.
   - "image_optimization": switch <img> to next/image with proper width/height.
   - "sitemap_robots": add src/app/sitemap.ts and src/app/robots.ts (App Router) or public/sitemap.xml + public/robots.txt.
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
