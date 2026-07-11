"use client";
import type { Suggestion } from "@growth/shared/types";

interface Props {
  suggestion: Suggestion | null;
  onClose: () => void;
}

/**
 * Generate-a-PR dialog. Automatic pull-request generation is still under
 * development, so this simply lets the user know it's coming and points them
 * to LinkedIn for the latest updates.
 */
export function DevelopDialog({ suggestion, onClose }: Props) {
  if (!suggestion) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.35)", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 540,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <div className="label" style={{ marginBottom: 6 }}>Generate pull request</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>
            {suggestion.title}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            {suggestion.description}
          </div>
        </div>

        {/* Body — feature under development */}
        <div style={{ padding: "20px 24px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent-strong)",
              background: "var(--accent-soft, #ecfdf5)",
              border: "1px solid #bbf7d0",
              borderRadius: 999,
              padding: "4px 11px",
              marginBottom: 14,
            }}
          >
            🚧 Under development
          </div>
          <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 16 }}>
            Automatic pull-request generation is currently{" "}
            <strong style={{ color: "var(--fg)" }}>under development</strong> and will be
            available here once it&apos;s ready. Your audit and every recommendation stay
            fully open in the meantime.
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.6 }}>
            Connect with me on LinkedIn for the latest updates:
            <br />
            <a
              href="https://www.linkedin.com/in/akshat-baranwal-936797313/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent-strong)", fontWeight: 600, wordBreak: "break-all" }}
            >
              linkedin.com/in/akshat-baranwal-936797313
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            Coming soon — thanks for your patience.
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <a
              className="btn btn-primary"
              href="https://www.linkedin.com/in/akshat-baranwal-936797313/"
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
            >
              Connect on LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
