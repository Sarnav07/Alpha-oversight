"use client";

import Link from "next/link";

/**
 * LandingNav — AlphaLedger-style floating top navigation for the A&O landing page.
 *
 * Sits fixed at the top, full width, over a transparent background so it can
 * float across the alternating light/dark scrollytelling frames of the hero.
 *
 * The legibility trick (cloned from AlphaLedger): the primary nav content sits
 * in a `mix-blend-mode: difference` layer so white ink reads as dark over the
 * white hero and as light over the obsidian dashboard frame — no theme-aware
 * JS scroll listener needed. The "Band: connected" pill and the solid CTA
 * button are deliberately kept OUTSIDE the blend layer (difference-blending a
 * filled pill/button produces muddy, illegible chroma), so they render with
 * fixed, self-contained contrast instead.
 *
 * Self-contained, prop-less, default export.
 */

const LINKS: ReadonlyArray<{ label: string; href: string; isRoute?: boolean }> = [
  { label: "Overview", href: "#overview" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Live Desk", href: "/desk", isRoute: true },
  { label: "Audit", href: "#audit" },
];

export default function LandingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full">
      <nav className="mx-auto flex h-16 max-w-[var(--maxw-content)] items-center justify-between px-6 sm:px-10 lg:px-14">
        {/* ── blend layer: brand + links auto-invert over light/dark frames ── */}
        <div
          className="flex flex-1 items-center justify-between"
          style={{ mixBlendMode: "difference" }}
        >
          {/* brand */}
          <Link
            href="/"
            aria-label="Alpha &amp; Oversight — home"
            className="group flex items-center gap-2.5 text-white"
          >
            {/* ◢ logomark: a small square with an open top, rotated 45° */}
            <span
              aria-hidden="true"
              className="inline-block h-3.5 w-3.5 rotate-45 rounded-tl-[3px] border-[1.5px] border-current border-b-0 border-r-0 transition-transform duration-300 ease-out group-hover:rotate-[135deg]"
            />
            <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.16em] text-white">
              Alpha &amp; Oversight
            </span>
          </Link>

          {/* center / right links */}
          <ul className="hidden items-center gap-7 md:flex">
            {LINKS.map((link) =>
              link.isRoute ? (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-sans text-[12px] tracking-wide text-white/70 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ) : (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="font-sans text-[12px] tracking-wide text-white/70 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ),
            )}
          </ul>
        </div>

        {/* ── outside the blend layer: fixed-contrast status pill + CTA ── */}
        <div className="ml-7 flex items-center gap-3">
          {/* Band: connected status pill */}
          <span className="hidden items-center gap-1.5 rounded-[var(--r-pill)] border border-white/15 bg-black/25 px-3 py-1.5 backdrop-blur-sm sm:inline-flex">
            <span
              aria-hidden="true"
              className="relative inline-block h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: "var(--verdict-complete)",
                boxShadow: "0 0 6px var(--verdict-complete)",
              }}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/80">
              Band: connected
            </span>
          </span>

          {/* Launch Desk CTA */}
          <Link
            href="/desk"
            className="group inline-flex items-center gap-1.5 rounded-[var(--r-pill)] bg-white px-4 py-2 font-sans text-[12px] font-medium tracking-wide text-[var(--obsidian)] shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_2px_10px_rgba(0,0,0,0.35)] transition-all duration-200 hover:bg-white/90"
          >
            Launch Desk
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
