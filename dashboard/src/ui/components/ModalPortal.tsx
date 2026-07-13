"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into <body> instead of in place.
 *
 * Overlays must escape the landing page's stacking contexts: `.hero` and
 * `.cta-band` carry `isolation: isolate` (for their aurora layers), so a fixed
 * overlay rendered inside them is trapped in that context and gets painted over
 * by any later positioned section. Portalling to <body> puts the overlay back in
 * the root stacking context, where its z-index means what it says.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
