"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ComputeBoardArt from "./art/ComputeBoardArt";
import { useIsMobile } from "./useIsMobile";

gsap.registerPlugin(ScrollTrigger);

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
 * static stacked layout (headline, then board with labels shown) renders instead
 * — the same gate HeroScroll uses.
 *
 * The visual is a BESPOKE monochrome compute board (ComputeBoardArt) — we can't
 * use AlphaLedger's Nvidia photo. Prop-less, self-contained, default export.
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

    const ctx = gsap.context((self) => {
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

    return () => ctx.revert();
    // rebuild on the mobile boundary cross (matches the active render path).
  }, [isMobile]);

  // ── Static fallback (reduced-motion OR mobile) ──────────────────────────
  if (reduced === true || isMobile === true) {
    return (
      <section className="relative w-full overflow-hidden bg-[var(--obsidian)] px-6 py-24">
        <div className="mx-auto flex max-w-[var(--maxw-content)] flex-col items-start gap-12">
          <Headline />
          <BoardWithLabels />
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

          {/* right — board + overlaid callout cards */}
          <BoardWithLabels boardClass="pb-board" labelClass="pb-label" />
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
        Frontier referees, open-weight adversaries, and a deterministic rule
        engine — coordinated across the Band, every handoff hash-chained.
      </p>
    </div>
  );
}

type LabelDef = { t: string; s: string; tone: string; pos: string };

/** the four floating callout cards (their resting positions over the board). */
const LABELS: LabelDef[] = [
  { t: "Adversarial R&D", s: "open-weight models", tone: "var(--tier-open)", pos: "top-[4%] left-[6%]" },
  { t: "Surveillance Desk", s: "frontier models", tone: "var(--tier-frontier)", pos: "top-[20%] right-[3%]" },
  { t: "Hash-chained Audit", s: "tamper-evident ledger", tone: "var(--verdict-complete)", pos: "bottom-[22%] left-[2%]" },
  { t: "Band Coordination", s: "cross-desk handoffs", tone: "var(--desk-surv)", pos: "bottom-[5%] right-[7%]" },
];

function CalloutCard({ def, className }: { def: LabelDef; className?: string }) {
  return (
    <div
      className={`absolute ${def.pos} ${className ?? ""} w-[min(220px,46%)] rounded-[14px] border p-3 backdrop-blur-md`}
      style={{
        background: "rgba(10,11,13,0.72)",
        borderColor: "rgba(255,255,255,0.12)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: def.tone }} />
        <span className="font-sans text-[13px] font-medium text-[var(--frost)]">{def.t}</span>
      </div>
      <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {def.s}
      </span>
    </div>
  );
}

/** The compute board with the four callout cards overlaid (both render paths). */
function BoardWithLabels({
  boardClass,
  labelClass,
}: {
  boardClass?: string;
  labelClass?: string;
}) {
  return (
    <div className={`relative w-full ${boardClass ?? ""}`}>
      <div className="aspect-[700/452] w-full">
        <ComputeBoardArt />
      </div>
      {LABELS.map((def) => (
        <CalloutCard key={def.t} def={def} className={labelClass} />
      ))}
    </div>
  );
}
