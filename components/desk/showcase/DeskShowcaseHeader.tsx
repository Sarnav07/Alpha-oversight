"use client";

import Link from "next/link";
import Logomark from "@/components/landing/Logomark";

/**
 * DeskShowcaseHeader — thin sticky brand bar for the /desk showcase (3.5rem, so
 * the pinned `top-14` stages tuck below it). Dark glass; links home + to
 * /how-it-works + a jump to the embedded live demo.
 */
export function DeskShowcaseHeader() {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between border-b px-5 sm:px-8"
      style={{
        height: "3.5rem",
        borderColor: "var(--hairline)",
        backgroundColor: "rgba(2,2,2,0.72)",
        backdropFilter: "blur(10px)",
        color: "var(--text-primary)",
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
          style={{ backgroundColor: "var(--frost)", color: "var(--obsidian)" }}
        >
          Live demo
        </a>
      </nav>
    </header>
  );
}
