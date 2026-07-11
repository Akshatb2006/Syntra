"use client";
import dynamic from "next/dynamic";

/**
 * Loads the ambient-motion / scroll-reveal engine as a separate client chunk
 * AFTER hydration, keeping its JS off the initial critical-path bundle (cuts
 * main-thread work + JS execution time on first load). It's pure enhancement —
 * the landing is fully visible without it (the reveal system only arms once JS
 * adds `.reveal-ready`, and the hero/LCP isn't reveal-gated) — so deferring it
 * doesn't affect LCP, CLS, or no-JS rendering.
 */
const LandingMotion = dynamic(
  () => import("./LandingMotion").then((m) => m.LandingMotion),
  { ssr: false },
);

export function LandingMotionLazy() {
  return <LandingMotion />;
}
