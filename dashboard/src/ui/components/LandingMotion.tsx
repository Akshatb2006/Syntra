"use client";

import { useEffect } from "react";

/**
 * Cinematic + premium motion driver for the landing page. Dependency-free,
 * progressive, and accessible:
 *   • Adds `reveal-ready` to <html> so the hidden/animated states in landing.css
 *     only apply once JS is alive — no-JS visitors get the full page, no FOUC.
 *   • IntersectionObserver reveals `[data-reveal]` / `[data-reveal-children]`
 *     elements as they enter the viewport (one-shot, then unobserved).
 *   • A rAF-throttled scroll loop drives: nav elevation, `[data-parallax]`
 *     layers, and the top scroll-progress beam.
 *   • Pointer-driven premium layer (only on fine pointers, off under
 *     reduced-motion): hero cursor spotlight, 3D tilt on the hero preview, and
 *     magnetic `[data-magnetic]` buttons.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    root.classList.add("reveal-ready");
    const cleanups: Array<() => void> = [() => root.classList.remove("reveal-ready")];

    /* ── Scroll reveal ──────────────────────────────────────────────── */
    const revealEls = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-children]"),
    );
    if (reduce || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              io.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
      );
      revealEls.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    /* ── Lightweight scroll cue: give the sticky nav a shadow once the page
       has moved. Just a class toggle — no per-frame layout work, scrolling
       stays completely free. The app shell scrolls each page in its own
       region, so listen on `.syntra-landing` when it's the overflow element. */
    const scroller = document.querySelector<HTMLElement>(".syntra-landing");
    const usesInner = !!scroller && scroller.scrollHeight > scroller.clientHeight + 4;
    const scrollTarget: HTMLElement | Window = usesInner && scroller ? scroller : window;
    const readY = () => (usesInner && scroller ? scroller.scrollTop : window.scrollY);
    const nav = document.querySelector<HTMLElement>(".lp-nav");
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (nav) nav.classList.toggle("is-scrolled", readY() > 8);
        ticking = false;
      });
    };
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    cleanups.push(() => scrollTarget.removeEventListener("scroll", onScroll));

    /* ── Premium pointer layer (fine pointer + motion allowed) ───────── */
    if (finePointer && !reduce) {
      // Hero cursor spotlight.
      const hero = document.querySelector<HTMLElement>(".hero");
      if (hero) {
        const onHeroMove = (e: MouseEvent) => {
          const r = hero.getBoundingClientRect();
          hero.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
          hero.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
        };
        hero.addEventListener("mousemove", onHeroMove);
        cleanups.push(() => hero.removeEventListener("mousemove", onHeroMove));
      }

      // 3D tilt on the hero preview panel.
      const tilt = document.querySelector<HTMLElement>(".hero-preview-tilt");
      const panel = tilt?.querySelector<HTMLElement>(".hero-preview");
      if (tilt && panel) {
        let raf = 0;
        const onTilt = (e: MouseEvent) => {
          const r = tilt.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            panel.style.transform = `rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) translateY(-4px)`;
          });
        };
        const onLeave = () => {
          cancelAnimationFrame(raf);
          panel.style.transform = "";
        };
        tilt.addEventListener("mousemove", onTilt);
        tilt.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          tilt.removeEventListener("mousemove", onTilt);
          tilt.removeEventListener("mouseleave", onLeave);
          cancelAnimationFrame(raf);
        });
      }

      // Magnetic buttons.
      const magnets = Array.from(document.querySelectorAll<HTMLElement>("[data-magnetic]"));
      for (const m of magnets) {
        const onMove = (e: MouseEvent) => {
          const r = m.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) * 0.3;
          const dy = (e.clientY - (r.top + r.height / 2)) * 0.4;
          m.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
        };
        const onLeave = () => { m.style.transform = ""; };
        m.addEventListener("mousemove", onMove);
        m.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          m.removeEventListener("mousemove", onMove);
          m.removeEventListener("mouseleave", onLeave);
        });
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
