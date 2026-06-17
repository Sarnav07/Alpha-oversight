"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useIsMobile } from "./useIsMobile";

/**
 * PoweredBySection — the "Powered by…" scroll-pinned reveal (AlphaLedger clone,
 * themed for A&O). One PINNED dark stage drives a scrubbed GSAP timeline:
 *
 *   start  — the headline sits DEAD-CENTER on obsidian; the board is offscreen-right.
 *   reveal — the headline translates to its LEFT rest position while the compute
 *            board slides in from the right (xPercent 120 → 0, fades up).
 *   labels — four frosted callout cards stagger in over the board.
 *   hold   — the composed state holds, then scrolls on to <UnlockSection/>.
 *
 * Reduced-motion OR mobile (<768px): the pin/scrub is skipped entirely and a
 * static stacked layout (headline, then the panel with its rows shown) renders
 * instead — the same gate HeroScroll uses.
 *
 * The right column is a "why we're different" panel (DifferencePanel) stating the
 * A&O differentiators. Prop-less, self-contained, default export.
 */
export default function PoweredBySection() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    // Reduced motion OR a small viewport: do not build the pinned timeline.
    if (mq.matches || window.matchMedia("(max-width: 767px)").matches) return;

    // Lazy-load gsap off the landing critical path: dynamically import it (+the
    // ScrollTrigger plugin) inside the effect, then build the SAME pinned
    // timeline a tick later — fine for a scroll-triggered animation.
    let cancelled = false;
    let ctx: gsap.Context | undefined;

    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      if (cancelled) return;

      ctx = gsap.context((self) => {
        const q = self.selector!;
        const stage = q(".pb-stage")[0] as HTMLElement | undefined;
        const head = q(".pb-head")[0] as HTMLElement | undefined;
        const board = q(".pb-board");
        const labels = q(".pb-label");
        if (!stage || !head) return; // defensive: never let a selector miss crash render

        // Measure the exact offset that visually centers the (left-column) headline
        // over the whole viewport, so it starts dead-center then settles left.
        const r = head.getBoundingClientRect();
        const centerOffset = window.innerWidth / 2 - (r.left + r.width / 2);

        gsap.set(head, { x: centerOffset });
        gsap.set(board, { xPercent: 120, opacity: 0 });
        gsap.set(labels, { opacity: 0, x: 22 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            pin: stage,
            pinSpacing: false,
            anticipatePin: 1,
          },
        });

        // 0.00–0.15 — hold: headline centered, board offscreen.
        tl.to({}, { duration: 0.15 });

        // 0.15–0.55 — headline slides to its left rest; board slides in from right.
        tl.to(head, { x: 0, duration: 0.4, ease: "power2.out" }, 0.15);
        tl.to(board, { xPercent: 0, opacity: 1, duration: 0.42, ease: "power2.out" }, 0.17);

        // 0.55–0.84 — the four callout cards stagger in over the board.
        tl.to(labels, { opacity: 1, x: 0, duration: 0.1, stagger: 0.07, ease: "power1.out" }, 0.56);

        // 0.84–1.00 — gentle continued drift so the pin releases with life.
        tl.to(board, { xPercent: -2, duration: 0.16 }, 0.84);

        ScrollTrigger.refresh();
      }, rootRef);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
    // rebuild on the mobile boundary cross (matches the active render path).
  }, [isMobile]);

  // ── Static fallback (reduced-motion OR mobile) ──────────────────────────
  if (reduced === true || isMobile === true) {
    return (
      <section className="relative w-full overflow-hidden bg-[var(--obsidian)] px-6 py-24">
        <div className="mx-auto flex max-w-[var(--maxw-content)] flex-col items-start gap-12">
          <Headline />
          <DifferencePanel />
        </div>
      </section>
    );
  }

  // ── Motion (and pre-measure) render ─────────────────────────────────────
  return (
    <div ref={rootRef} className="relative h-[260vh] bg-[var(--obsidian)]">
      <div className="pb-stage sticky top-0 flex h-screen w-full items-center overflow-hidden bg-[var(--obsidian)]">
        <div className="mx-auto grid w-full max-w-[var(--maxw-content)] grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2">
          {/* left — headline (starts viewport-centered via measured x offset) */}
          <div className="pb-head">
            <Headline />
          </div>

          {/* right — the "why we're different" panel (slides in; rows stagger) */}
          <DifferencePanel boardClass="pb-board" labelClass="pb-label" />
        </div>
      </div>
    </div>
  );
}

const EYEBROW = "Infrastructure";

/** The two-tone "Powered by…" headline + sub (shared by both render paths). */
function Headline() {
  return (
    <div className="max-w-xl">
      <span className="mb-5 inline-block font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
        {EYEBROW}
      </span>
      <h2
        className="font-sans"
        style={{
          fontWeight: 420,
          letterSpacing: "-0.012em",
          lineHeight: 1.06,
          fontSize: "clamp(30px, 4.4vw, 60px)",
          color: "var(--text-primary)",
        }}
      >
        Powered by industry-grade{" "}
        <span style={{ color: "#9a9a9a" }}>multi-agent AI.</span>
      </h2>
      <p
        className="mt-6 font-sans"
        style={{ fontSize: "clamp(14px, 1.5vw, 17px)", lineHeight: 1.5, color: "var(--text-body)" }}
      >
        Frontier and open-weight referees, an open-weight adversary, and a
        deterministic rule engine — coordinated across the Band, every handoff
        hash-chained.
      </p>
    </div>
  );
}

type Diff = { t: string; lead: string; detail: string; tone: string };

/** the four differentiators — "X, not Y" framing answers "why us, not them". */
const DIFFS: Diff[] = [
  {
    t: "Adversarial by design",
    lead: "Proactive, not reactive",
    detail: "An open-weight red-team invents the next evasion before the market does — Surveillance trains on tomorrow's attack.",
    tone: "var(--tier-open)",
  },
  {
    t: "Deterministic verdicts",
    lead: "Explainable, not a black box",
    detail: "A rule engine makes the PASS / FLAG call — not an opaque model. Every verdict is reproducible.",
    tone: "var(--tier-frontier)",
  },
  {
    t: "Provable by construction",
    lead: "Tamper-evident, not “trust us”",
    detail: "Every handoff and verdict is hash-chained into a replayable, audit-ready ledger.",
    tone: "var(--verdict-complete)",
  },
  {
    t: "Coordinated, not wrapped",
    lead: "A real system, not a wrapper",
    detail: "Nine roles hand off real evidence across a Chinese wall over Band — visible end to end.",
    tone: "var(--desk-surv)",
  },
];

/** The "why we're different" panel (replaces both render paths' right column). */
function DifferencePanel({
  boardClass,
  labelClass,
}: {
  boardClass?: string;
  labelClass?: string;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[20px] border ${boardClass ?? ""}`}
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background: "linear-gradient(180deg, #14161c 0%, #0a0b0d 100%)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* soft top glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 75% at 82% 0%, rgba(255,255,255,0.055), transparent 60%)" }}
      />

      <div className="relative p-6 sm:p-8">
        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Why we&apos;re different
          </span>
          <span
            className="shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] text-[var(--text-muted)]"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            8 agents · 1 rule engine · 2 tiers
          </span>
        </div>

        <p
          className="mt-4 font-sans"
          style={{ fontSize: "clamp(19px, 2vw, 25px)", fontWeight: 420, lineHeight: 1.18, color: "var(--frost)" }}
        >
          Not another ML black box.
        </p>

        {/* differentiator rows */}
        <ul className="mt-5 flex flex-col">
          {DIFFS.map((d, i) => (
            <li
              key={d.t}
              className={`${labelClass ?? ""} flex gap-3 py-3.5`}
              style={{ borderTop: i ? "1px solid var(--hairline)" : "none" }}
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: d.tone, boxShadow: `0 0 8px ${d.tone}` }}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-sans text-[14px] font-medium text-[var(--frost)]">{d.t}</span>
                  <span className="font-mono text-[10.5px]" style={{ color: d.tone }}>
                    {d.lead}
                  </span>
                </div>
                <p className="mt-1 font-sans text-[12.5px] leading-snug text-[var(--text-muted)]">{d.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
