import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "warn" | "danger" | "success" | "muted";

const STYLE: Record<Tone, string> = {
  neutral: "bg-zinc-800 text-zinc-200",
  accent: "bg-teal-900/60 text-teal-200",
  warn: "bg-amber-900/40 text-amber-200",
  danger: "bg-rose-900/40 text-rose-200",
  success: "bg-emerald-900/40 text-emerald-200",
  muted: "bg-zinc-900 text-zinc-400",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STYLE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
