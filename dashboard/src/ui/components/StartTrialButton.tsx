"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The "Start a free run" nav CTA. Because the trial starts by pasting a URL into
 * the hero box (no sign-up wall), this doesn't navigate — on hover it explains
 * where to go, and on click it scrolls to the hero, focuses the URL field, and
 * pulses it. Falls back to an `#top` anchor with no JS.
 */
export function StartTrialButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const pinned = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function pointToBox(e: React.MouseEvent) {
    e.preventDefault();
    const hero = document.getElementById("top");
    const input = document.querySelector<HTMLInputElement>(".hero-audit-input");
    hero?.classList.add("is-prompting");
    hero?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => input?.focus({ preventScroll: true }), 340);

    setShow(true);
    pinned.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      pinned.current = false;
      setShow(false);
      hero?.classList.remove("is-prompting");
    }, 2800);
  }

  return (
    <span className="nav-cta-wrap">
      <a
        className={className}
        href="#top"
        onClick={pointToBox}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => {
          if (!pinned.current) setShow(false);
        }}
      >
        {children}
      </a>
      <span className={`cta-tip${show ? " show" : ""}`} role="status">
        Enter your website URL to request early access
      </span>
    </span>
  );
}
