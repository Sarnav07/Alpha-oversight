"use client";

import BandNonagon from "./BandNonagon";
import ArchitectureDiagram from "@/components/how-it-works/diagram/ArchitectureDiagram";

/**
 * HeroSplitArt - the artwork that fills the laptop screen during the hero
 * scrollytelling (and bursts full-bleed at frame 3). Two panes of the SAME story
 * the site tells, in one visual family:
 *
 *   LEFT  - THE BAND topology: the nine-role nonagon (the "#overview" art), Band
 *           the hub every hand-off binds to.
 *   RIGHT - ARCHITECTURE (report Fig 1): two desks across the Chinese wall, the
 *           Band spine, the gold rule engine as sole authority, the hash-chained
 *           ledger.
 *
 * Replaces the old CommandCenterArt as the hero screen content (the Mac
 * device-zoom motion in HeroScroll is unchanged). Fills its parent (w-full
 * h-full). Tagged `data-section="dark"` so tokens resolve to frost-on-obsidian
 * inside the (light) hero stage - the token gotcha. Self-contained, prop-less,
 * default export; reduced-motion renders the final state (diagrams own their own
 * fallback; the nonagon is fed `show`).
 */
export default function HeroSplitArt() {
  // The hero art is a "screenshot on a laptop": both diagrams render in their
  // final, fully-drawn state. No scroll-in self-draw here - the laptop sits
  // inside the GSAP device-zoom transform, where useInView can't fire reliably
  // (a half-drawn / blank pane was the bug) and any continuous animation would
  // jank the scrubbed scale. The self-draw lives on /how-it-works instead.
  return (
    <div
      data-section="dark"
      className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--obsidian)]"
    >
      {/* faint forensic blueprint grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in srgb, var(--band-blue) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--band-blue) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          backgroundPosition: "center",
          maskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, #000 40%, transparent 82%)",
          WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, #000 40%, transparent 82%)",
        }}
      />

      {/* window header - reads as a real screen */}
      <div
        className="relative z-10 flex shrink-0 items-center justify-between border-b px-[2.4%] py-[1.5%]"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-[5px]" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--desk-rnd)" }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--desk-surv)" }} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--verdict-escalate)" }} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            A&amp;O · The Band
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--band-blue)" }} aria-hidden />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
            Band · connected
          </span>
        </div>
      </div>

      {/* two panes split by the band-blue "wall" seam */}
      <div className="relative z-10 grid flex-1 grid-cols-2">
        {/* the wall seam (vertical band-blue line down the centre) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-[6%] left-1/2 w-px -translate-x-1/2"
          style={{
            background:
              "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--band-blue) 40%, transparent) 18%, color-mix(in srgb, var(--band-blue) 40%, transparent) 82%, transparent)",
          }}
        />

        {/* LEFT - the Band topology */}
        <figure className="flex min-w-0 flex-col px-[3.4%] py-[2.6%]">
          <figcaption className="mb-[2%] font-mono text-[9.5px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--band-blue)" }}>01</span>&nbsp;&nbsp;coordination topology — nine roles, one loop
          </figcaption>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <BandNonagon show reduce className="h-auto w-full" />
          </div>
        </figure>

        {/* RIGHT - the architecture (report Fig 1) */}
        <figure className="flex min-w-0 flex-col px-[3.4%] py-[2.6%]">
          <figcaption className="mb-[2%] font-mono text-[9.5px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--band-blue)" }}>02</span>&nbsp;&nbsp;architecture — two desks, one wall
          </figcaption>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <ArchitectureDiagram staticMode />
          </div>
        </figure>
      </div>
    </div>
  );
}
