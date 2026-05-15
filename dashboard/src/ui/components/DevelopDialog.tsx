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

export function DevelopDialog({ runId, suggestion, onClose, onDispatched }: Props) {
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
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onDispatched?.(suggestion!.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 540,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.14)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div className="label" style={{ marginBottom: 6 }}>Develop suggestion</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg)', marginBottom: 6 }}>
            {suggestion.title}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            {suggestion.description}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          <div className="form-field">
            <label className="form-label">Additional instruction <span style={{ color: 'var(--fg-dim)', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              disabled={busy}
              className="form-input"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="e.g. Use the existing schema component, avoid touching the layout file…"
            />
            <div className="form-hint">
              Appended to the Claude Code prompt. Leave blank to implement as-is.
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-soft)', border: '1px solid #fecdd3',
              borderRadius: 7, padding: '10px 14px',
              fontSize: 12.5, color: 'var(--danger)', marginTop: 14,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => fire(false)} disabled={busy}>
            {busy ? "Dispatching…" : "Develop as-is"}
          </button>
          <button className="btn btn-primary" onClick={() => fire(true)} disabled={busy || !prompt.trim()}>
            {busy ? "Dispatching…" : "Develop with prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}
