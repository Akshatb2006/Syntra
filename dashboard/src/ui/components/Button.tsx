import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const STYLE: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--bg-elev)] disabled:opacity-50",
  ghost:
    "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elev)] disabled:opacity-50",
  danger:
    "bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-50",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${STYLE[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
