import type { ReactNode } from "react";

type Tone = "success" | "danger" | "warn" | "accent" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  success: "badge-success",
  danger: "badge-danger",
  warn: "badge-warn",
  accent: "badge-accent",
  muted: "badge-muted",
};

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{children}</span>;
}
