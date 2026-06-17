"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import Logomark from "@/components/landing/Logomark";

/**
 * DeskShowcaseHeader - thin sticky brand bar for the /desk showcase (3.5rem, so
 * the pinned `top-14` stages tuck below it). Dark glass; links home + to
 * /how-it-works + a jump to the embedded live demo.
 *
 * Auto-hides once the live Command Center (#live-desk) scrolls into the top of
 * the viewport, so the dashboard gets the full screen height. Slides back in on
 * scroll-up. Reduced-motion toggles instantly (no slide).
 */
export function DeskShowcaseHeader() {
  const reduce = useReducedMotion() ?? false;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const desk = document.getElementById("live-desk");
    if (!desk) return;
    // Fire when the live desk crosses into the top sliver of the viewport - i.e.
    // the operator has reached the dashboard. rootMargin shrinks the root to the
    // top ~12%, so the bar only hides once the desk owns the top of the screen.
    const io = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { rootMargin: "0px 0px -88% 0px", threshold: 0 },
    );
    io.observe(desk);
    return () => io.disconnect();
  }, []);

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between border-b px-5 sm:px-8"
      style={{
        height: "3.5rem",
        borderColor: "var(--hairline)",
        backgroundColor: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(10px)",
        color: "var(--text-primary)",
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: reduce
          ? "none"
          : "transform 0.35s var(--ease-out), opacity 0.35s var(--ease-out)",
      }}
    >
      <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        <Logomark size={18} />
        <span className="font-sans text-[14px] font-medium tracking-[-0.01em]">Alpha &amp; Oversight</span>
      </Link>
      <nav className="flex items-center gap-5 font-sans text-[13px]" style={{ color: "var(--text-muted)" }}>
        <Link href="/how-it-works" className="transition-colors hover:text-[color:var(--text-primary)]">
          How it works
        </Link>
        <a
          href="#live-desk"
          className="rounded-[var(--r-pill)] px-3.5 py-1.5 text-[12.5px] font-medium"
          style={{ backgroundColor: "var(--obsidian)", color: "var(--frost)" }}
        >
          Live demo
        </a>
      </nav>
    </header>
  );
}
