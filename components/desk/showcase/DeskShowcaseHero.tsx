"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { DeskBackdrop } from "./DeskBackdrop";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/** Line-mask heading that plays on MOUNT (the hero is on-screen immediately, so
 *  a whileInView trigger can miss it). Reduced motion → static. */
function HeroHeading({ reduce }: { reduce: boolean }) {
  const lines = [
    { t: "Watch the system", color: "var(--text-primary)" },
    { t: "think — live.", color: "var(--text-faint)" },
  ];
  if (reduce) {
    return (
      <h1 className="mx-auto mt-6 max-w-4xl font-sans">
        {lines.map((l) => (
          <span key={l.t} className="block text-[clamp(34px,6vw,68px)] font-light leading-[1.04] tracking-[-0.02em]" style={{ color: l.color }}>
            {l.t}
          </span>
        ))}
      </h1>
    );
  }
  return (
    <motion.h1
      id="desk-hero-title"
      className="mx-auto mt-6 max-w-4xl font-sans"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
    >
      {lines.map((l) => (
        <span key={l.t} className="block overflow-hidden">
          <motion.span
            className="block text-[clamp(34px,6vw,68px)] font-light leading-[1.04] tracking-[-0.02em]"
            style={{ color: l.color }}
            variants={{ hidden: { y: "115%" }, show: { y: "0%", transition: { duration: 0.85, ease: EASE } } }}
          >
            {l.t}
          </motion.span>
        </span>
      ))}
    </motion.h1>
  );
}

/**
 * DeskShowcaseHero — the opening pinned stage of the /desk showcase. Dark
 * Command-Center backbone with the ambient backdrop; a live pulse, a two-tone
 * heading (report §11 — "the live operations view that matters for a demo"), and
 * a faint always-running trace motif (agent dots + a Band token sweeping the
 * spine) to set the tone. CTAs jump to the embedded live desk or back to /how.
 */
function TraceMotif({ reduce }: { reduce: boolean }) {
  const DOTS = [8, 26, 44, 62, 80]; // % positions along the spine
  return (
    <div aria-hidden="true" className="relative mx-auto mt-16 h-10 w-full max-w-2xl">
      <span
        className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
        style={{ background: "var(--hairline)" }}
      />
      {DOTS.map((x, i) => (
        <span
          key={x}
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
          style={{
            left: `calc(${x}% - 4px)`,
            backgroundColor: "var(--bg-card-2)",
            border: "1px solid var(--border-default)",
            ...(i === 2 ? { borderColor: "var(--desk-surv)" } : null),
          }}
        />
      ))}
      {!reduce ? (
        <motion.span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
          style={{
            left: "-2px",
            backgroundColor: "var(--band-blue)",
            boxShadow: "0 0 10px var(--band-blue)",
          }}
          animate={{ left: ["2%", "98%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
    </div>
  );
}

export function DeskShowcaseHero() {
  const reduce = useReducedMotion() ?? false;
  return (
    <section
      aria-labelledby="desk-hero-title"
      className="relative flex min-h-[calc(100vh-3.5rem)] items-center overflow-hidden"
      style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      <DeskBackdrop />
      <div className="relative mx-auto w-full px-6 py-24 text-center" style={{ maxWidth: "var(--maxw-content)" }}>
        <Reveal>
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            <span className="relative flex h-2 w-2">
              {!reduce ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ backgroundColor: "var(--verdict-pass)", opacity: 0.6 }} />
              ) : null}
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: "var(--verdict-pass)" }} />
            </span>
            Live Command Center
          </span>
        </Reveal>

        <HeroHeading reduce={reduce} />

        <Reveal delay={0.1}>
          <p className="mx-auto mt-7 max-w-2xl font-sans" style={{ fontSize: "clamp(15px,1.6vw,18px)", lineHeight: 1.6, color: "var(--text-body)" }}>
            Every agent action streams in real time, every handoff crosses Band,
            every verdict is sealed into a hash-chained ledger you can verify on
            the spot. Scroll through how the desk is wired — then run the real
            Beat-B demo at the end.
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#live-desk"
              className="inline-flex items-center gap-2 rounded-[var(--r-pill)] px-6 py-3 font-sans text-[14px] font-medium transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: "var(--frost)", color: "var(--obsidian)" }}
            >
              Jump to the live desk <span aria-hidden="true">↓</span>
            </a>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-[var(--r-pill)] border px-6 py-3 font-sans text-[14px] font-medium transition-colors hover:bg-[var(--bg-card)]"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              How it works
            </Link>
          </div>
        </Reveal>

        <TraceMotif reduce={reduce} />

        <Reveal delay={0.25}>
          <div className="mt-14 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>
            <span>Scroll</span>
            <motion.span
              aria-hidden="true"
              animate={reduce ? undefined : { y: [0, 5, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              ↓
            </motion.span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
