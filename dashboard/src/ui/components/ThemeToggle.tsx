"use client";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Light/dark toggle. The actual theme is applied pre-paint by the inline script
 * in the root layout (reads localStorage, falls back to the OS preference), so
 * this component just reflects and flips `document.documentElement.dataset.theme`
 * and persists the choice. Renders nothing until mounted to avoid hydration
 * mismatch (server can't know the resolved theme).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("syntra-theme", next);
    } catch {
      /* storage blocked — still applies for this session */
    }
    setTheme(next);
  }

  // Reserve the slot before mount so the nav doesn't shift when it appears.
  if (theme === null) {
    return <span className="lp-theme-toggle" aria-hidden style={{ visibility: "hidden" }} />;
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="lp-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
