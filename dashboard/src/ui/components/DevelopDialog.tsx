"use client";
import { useEffect, useState } from "react";
import type { Suggestion } from "@growth/shared/types";
import { Button } from "./Button";

interface Props {
  runId: string;
  suggestion: Suggestion | null;
  onClose: () => void;
  onDispatched?: (suggestionId: string) => void;
}

/**
 * Modal that triggers a single Claude Code dispatch for the chosen suggestion.
 * The user picks one of three actions:
 *   - Cancel
 *   - Develop without prompt — implements the suggestion as-is
 *   - Develop with prompt — sends an additional human instruction to Claude Code
 */
export function DevelopDialog({
  runId,
  suggestion,
  onClose,
  onDispatched,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestion) {
      setPrompt("");
      setError(null);
      setBusy(false);
    }
  }, [suggestion]);

  if (!suggestion) return null;

  async function fire(withPrompt: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/runs/${runId}/suggestions/${suggestion!.id}/dispatch`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(withPrompt && prompt.trim() ? { prompt: prompt.trim() } : {}),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onDispatched?.(suggestion!.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const trimmedPrompt = prompt.trim();
  const promptDisabled = busy || trimmedPrompt.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-muted)]">
            Develop suggestion
          </div>
          <div className="mt-1 text-base font-medium text-[var(--fg)]">
            {suggestion.title}
          </div>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            {suggestion.description}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--fg-muted)]">
              Additional instruction (optional)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              disabled={busy}
              className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="e.g. Use the /en/ route too, prefer the existing schema component, avoid touching the layout file…"
            />
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              This is appended to the prompt Claude Code receives. Leave blank
              and use &quot;Develop without prompt&quot; to implement as-is.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-rose-900/30 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => fire(false)}
            disabled={busy}
          >
            {busy ? "Dispatching…" : "Develop without prompt"}
          </Button>
          <Button onClick={() => fire(true)} disabled={promptDisabled}>
            {busy ? "Dispatching…" : "Develop with prompt"}
          </Button>
        </div>
      </div>
    </div>
  );
}
