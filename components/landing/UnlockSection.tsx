"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import ShieldEmblem from "@/components/landing/ShieldEmblem";

/**
 * UnlockSection — the closing "Unlock the Full Power" CTA band (AlphaLedger
 * clone, themed for A&O). A DARK section: a two-tone heading over a 2×2 grid of
 * capability cards wrapped around a central hatched EMBLEM badge (the A&O shield
 * + logomark, with a pointed bottom). Cards stagger-reveal on scroll-in.
 *
 * Layout: a 3-column grid — left cards (col 1), the emblem (col 2, row-span 2),
 * right cards (col 3). Left cards are left-aligned, right cards right-aligned, so
 * the text leans toward the emblem. Collapses to a single column on mobile.
 *
 * Reduced-motion: everything renders in its final state immediately.
 * Prop-less, self-contained, default export.
 */

type Cap = {
  no: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  side: "left" | "right";
};

/* ── line icons (stroke = currentColor) ─────────────────────────────────── */
const ic = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function TraceIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...ic}>
      <path d="M3 13h3l2.5-7 4 14 2.5-7H21" />
    </svg>
  );
}
function AuditIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...ic}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 11.5l2 2 4-4.5" />
    </svg>
  );
}
function AdversaryIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...ic}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function BandIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" {...ic}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M7.7 7.6l3.1 8M16.3 7.6l-3.1 8M8.3 6h7.4" />
    </svg>
  );
}

const CAPS: Cap[] = [
  {
    no: "01",
    title: "Real-Time Trace",
    body: "Every agent step streams live — topology, model badges, verdicts, and the blue waiting-on-Band node.",
    icon: <TraceIcon />,
    side: "left",
  },
  {
    no: "02",
    title: "Tamper-Evident Audit",
    body: "Every decision is sealed in a hash-chained ledger. verify_chain ✓ — audit-ready by construction.",
    icon: <AuditIcon />,
    side: "right",
  },
  {
    no: "03",
    title: "Adversarial R&D",
    body: "A red-team desk invents the evasions the market hasn't seen — the threats Surveillance learns to catch.",
    icon: <AdversaryIcon />,
    side: "left",
  },
  {
    no: "04",
    title: "Coordinated over Band",
    body: "Every handoff crosses the Band, across a Chinese wall between the two desks — visible, never a wrapper.",
    icon: <BandIcon />,
    side: "right",
  },
];

/** The A&O shield emblem — the shared frosted badge, centred and spanning both
 *  card rows (matching the AlphaLedger "Unlock the Full Power" centre badge). */
function Emblem() {
  return (
    <ShieldEmblem
      className="mx-auto h-full w-full max-w-[300px] self-stretch"
      logoSize={42}
    />
  );
}

function CapCard({ cap }: { cap: Cap }) {
  const right = cap.side === "right";
  return (
    <div
      className={`flex h-full min-h-[190px] flex-col rounded-[var(--r-card)] border p-7 sm:min-h-[210px] ${
        right ? "items-end text-right" : "items-start text-left"
      }`}
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* top row: icon + number (icon toward the outer edge) */}
      <div
        className={`flex w-full items-start ${
          right ? "flex-row-reverse" : "flex-row"
        } justify-between`}
      >
        <span
          aria-hidden="true"
          className="flex items-center justify-center rounded-[10px] border text-[var(--text-primary)]"
          style={{
            width: 44,
            height: 44,
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-inset)",
          }}
        >
          {cap.icon}
        </span>
        <span className="font-mono text-[11px] tracking-[0.2em] text-[var(--text-faint)]">
          {cap.no}
        </span>
      </div>

      {/* title + body anchored to the bottom */}
      <div className="mt-auto pt-8">
        <h3
          className="font-sans"
          style={{
            fontSize: "clamp(18px, 1.9vw, 22px)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          {cap.title}
        </h3>
        <p
          className="mt-2.5 font-sans"
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text-muted)",
            maxWidth: "34ch",
          }}
        >
          {cap.body}
        </p>
      </div>
    </div>
  );
}

const PLACEMENT: Record<string, string> = {
  "01": "sm:col-start-1 sm:row-start-1",
  "02": "sm:col-start-3 sm:row-start-1",
  "03": "sm:col-start-1 sm:row-start-2",
  "04": "sm:col-start-3 sm:row-start-2",
};

export default function UnlockSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const show = reduce || inView;

  const rise = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 26 },
    animate: show ? { opacity: 1, y: 0 } : undefined,
    transition: {
      duration: 0.7,
      delay: 0.1 + i * 0.08,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  });

  return (
    <section
      aria-label="Unlock the full power"
      style={{ backgroundColor: "var(--obsidian)", color: "var(--text-primary)" }}
    >
      <div
        ref={ref}
        className="mx-auto px-6 pb-28 pt-24 sm:px-10 lg:pb-36 lg:pt-32"
        style={{ maxWidth: 1140 }}
      >
        {/* two-tone heading */}
        <motion.h2
          {...rise(0)}
          className="mx-auto text-center font-sans"
          style={{
            fontSize: "clamp(30px, 4.4vw, 52px)",
            fontWeight: 300,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
            maxWidth: 720,
          }}
        >
          Unlock the{" "}
          <span style={{ color: "var(--text-faint)" }}>full power</span> of
          <br className="hidden sm:block" /> adversarial surveillance
        </motion.h2>

        {/* card grid + central emblem */}
        <div className="mt-16 grid grid-cols-1 gap-4 sm:mt-20 sm:grid-cols-[1fr_minmax(230px,290px)_1fr] sm:grid-rows-2 sm:gap-5">
          {/* emblem — centre column, spans both rows */}
          <motion.div
            {...rise(1)}
            className="order-3 flex sm:order-none sm:col-start-2 sm:row-start-1 sm:row-span-2"
          >
            <Emblem />
          </motion.div>

          {CAPS.map((cap, i) => (
            <motion.div
              key={cap.no}
              {...rise(i + 2)}
              className={`${PLACEMENT[cap.no]} ${
                cap.no === "01" || cap.no === "02"
                  ? "order-1 sm:order-none"
                  : "order-4 sm:order-none"
              }`}
            >
              <CapCard cap={cap} />
            </motion.div>
          ))}
        </div>

        {/* closing CTA */}
        <motion.div {...rise(6)} className="mt-16 flex justify-center">
          <Link
            href="/desk"
            className="group inline-flex items-center gap-2 rounded-[var(--r-pill)] px-7 py-3.5 font-sans text-[14px] font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--frost)", color: "var(--obsidian)" }}
          >
            Enter the Live Desk
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
