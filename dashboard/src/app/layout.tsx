import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Autonomous Growth Engineer",
  description:
    "Multi-agent autonomous SEO/growth pipeline for real-estate websites.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-[var(--border)] bg-[var(--bg-elev)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-semibold tracking-tight"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)] pulse-soft" />
              Growth Engineer
            </Link>
            <nav className="flex gap-5 text-sm text-[var(--fg-muted)]">
              <Link href="/" className="hover:text-[var(--fg)]">
                Runs
              </Link>
              <Link href="/runs/new" className="hover:text-[var(--fg)]">
                New run
              </Link>
              <Link href="/connect" className="hover:text-[var(--fg)]">
                Connect
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
