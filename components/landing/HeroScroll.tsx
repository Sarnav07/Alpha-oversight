"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LandingNav from "./LandingNav";
import CommandCenterArt from "./CommandCenterArt";

gsap.registerPlugin(ScrollTrigger);

/**
 * HeroScroll — the pinned "device-zoom" scrollytelling hero (AlphaLedger clone,
 * themed for A&O). A single PINNED sticky stage drives a scrubbed GSAP timeline
 * across four reference frames:
 *
 *   FRAME 1 (light): hero headline + a laptop peeking from the bottom edge, a
 *     "We use cookies" consent card overlaid low, a bouncing down-arrow cue.
 *   FRAME 1→2: cookie card dismisses, hero text fades up & out, device rises.
 *   FRAME 2 (light→dark): device scales toward filling the viewport, bg crossfades
 *     white→obsidian, a circular ▶ play button fades in/out at center.
 *   FRAME 3 (dark): the bezel fades to 0, CommandCenterArt fills the viewport.
 *   FRAME 4 (dark→light): the dashboard scales ~1.05, translates up + fades out,
 *     handing off to <KeyFigures/> below.
 *
 * Reduced-motion: the pin/scrub is skipped entirely; a simple stacked static
 * layout (hero, then a framed CommandCenterArt) is rendered instead.
 *
 * Prop-less, self-contained, default export. Renders <LandingNav/> fixed over
 * everything (z above frames, below the Preloader at z-[100]).
 */
export default function HeroScroll() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // null = undecided (SSR/first paint), true/false once measured on the client
  const [reduced, setReduced] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    // Reduced motion: do not build the pinned timeline at all.
    if (mq.matches) return;

    const ctx = gsap.context((self) => {
      const q = self.selector!;
      const stage = q(".hero-stage")[0] as HTMLElement;
      const device = q(".hero-device")[0] as HTMLElement;
      const bezel = q(".hero-bezel");
      const heroText = q(".hero-text");
      const cookie = q(".hero-cookie");
      const arrow = q(".hero-arrow");
      const play = q(".hero-play");

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

      // ── initial states (FRAME 1) ──
      gsap.set(stage, { backgroundColor: "#ffffff" });
      gsap.set(device, { yPercent: 62, scale: 0.82, transformOrigin: "50% 0%" });
      gsap.set(heroText, { opacity: 1, y: 0 });
      gsap.set(cookie, { opacity: 1, y: 0 });
      gsap.set(play, { opacity: 0, scale: 0.7 });

      // Timeline spans progress 0→1 across the whole runway (total = 1 unit).
      // FRAME 1 hold: 0.00–0.16 (nothing animates; the device just sits peeking).
      tl.to({}, { duration: 0.16 });

      // 0.16–0.30 — cookie dismiss + hero text fades up & out + device rises to center.
      tl.to(cookie, { opacity: 0, y: 28, duration: 0.14 }, 0.16);
      tl.to(heroText, { opacity: 0, y: -40, duration: 0.14 }, 0.16);
      tl.to(arrow, { opacity: 0, duration: 0.08 }, 0.16);
      tl.to(device, { yPercent: 0, scale: 0.9, duration: 0.14 }, 0.16);

      // 0.30–0.60 — FRAME 2: device scales up toward filling viewport, bg crossfades
      // white→obsidian, play button fades in then out.
      tl.to(device, { scale: 1, duration: 0.30 }, 0.30);
      tl.to(stage, { backgroundColor: "#020202", duration: 0.30 }, 0.30);
      tl.to(play, { opacity: 1, scale: 1, duration: 0.12 }, 0.34);
      tl.to(play, { opacity: 0, scale: 1.3, duration: 0.12 }, 0.50);

      // 0.60–0.82 — FRAME 3: bezel fades to 0, CommandCenterArt fills the viewport.
      tl.to(bezel, { opacity: 0, duration: 0.14 }, 0.60);

      // hold frame 3 readable: 0.74–0.82
      tl.to({}, { duration: 0.08 });

      // 0.82–1.00 — FRAME 4: dashboard scales ~1.05, translates up + fades, handoff.
      tl.to(
        device,
        { scale: 1.05, yPercent: -14, opacity: 0, duration: 0.18 },
        0.82,
      );

      ScrollTrigger.refresh();
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // ── Reduced-motion static fallback ──────────────────────────────────────
  if (reduced === true) {
    return (
      <>
        <LandingNav />
        <section
          data-section="light"
          className="relative flex flex-col items-center px-6 pb-16 pt-32"
          style={{ backgroundColor: "var(--bg-page)" }}
        >
          <HeroCopy />
          <div className="mt-14 w-full max-w-[var(--maxw-content)]">
            <div className="overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-[var(--obsidian)] shadow-2xl">
              <div className="aspect-[16/10] w-full">
                <CommandCenterArt />
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  // ── Motion (and pre-measure) render ─────────────────────────────────────
  return (
    <>
      <LandingNav />
      {/* Outer runway — its height creates the scroll distance for the pin. */}
      <div ref={rootRef} className="relative h-[330vh]">
        {/* Sticky stage — pinned for the duration of the scroll. */}
        <div
          className="hero-stage sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#ffffff" }}
        >
          {/* Hero text (FRAME 1) — light, centered, sits above the device. */}
          <div
            data-section="light"
            className="hero-text pointer-events-none absolute inset-x-0 top-[18%] z-20 flex justify-center px-6"
          >
            <HeroCopy />
          </div>

          {/* The device (laptop). Holds CommandCenterArt as its screen. */}
          <div className="hero-device relative z-10 h-[78vh] w-[min(1180px,92vw)]">
            {/* bezel — fades to 0 in frame 3 so the dashboard reads full-bleed */}
            <div
              className="hero-bezel absolute inset-0 rounded-[22px] border bg-[var(--obsidian)]"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.08) inset, 0 40px 120px rgba(0,0,0,0.55)",
              }}
            />
            {/* screen — the actual dashboard art, inset inside the bezel */}
            <div className="absolute inset-[10px] overflow-hidden rounded-[14px] bg-[var(--obsidian)]">
              <CommandCenterArt />
            </div>

            {/* cookie consent card (FRAME 1) — overlaid low on the device */}
            <div className="hero-cookie absolute bottom-5 left-1/2 z-30 w-[min(440px,86%)] -translate-x-1/2">
              <div
                data-section="light"
                className="flex items-center gap-3 rounded-[12px] border bg-white/95 p-3.5 shadow-2xl backdrop-blur"
                style={{ borderColor: "var(--border-default)" }}
              >
                <p className="flex-1 font-sans text-[12px] leading-snug text-[var(--text-body)]">
                  We use cookies to calibrate surveillance thresholds and
                  remember your desk.
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-[var(--r-pill)] bg-[var(--obsidian)] px-3 py-1.5 font-sans text-[11px] font-medium text-white"
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="shrink-0 font-sans text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>

          {/* circular play button (FRAME 2) — center */}
          <div className="hero-play pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full border text-white"
              style={{
                borderColor: "rgba(255,255,255,0.35)",
                backgroundColor: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(2px)",
              }}
            >
              <span className="ml-1 text-[20px] leading-none">▶</span>
            </span>
          </div>

          {/* scroll cue (FRAME 1) — bottom-right bouncing arrow */}
          <div
            data-section="light"
            className="hero-arrow anim-scroll-cue pointer-events-none absolute bottom-6 right-6 z-30 flex flex-col items-center gap-1"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              scroll
            </span>
            <span className="text-[18px] leading-none text-[var(--text-primary)]">
              ↓
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/** The centered two-tone hero headline + sub (shared by both render paths). */
function HeroCopy() {
  return (
    <div className="max-w-3xl text-center">
      <h1
        className="font-sans"
        style={{
          fontWeight: 300,
          letterSpacing: "-0.01em",
          lineHeight: 1.04,
          fontSize: "clamp(38px, 7vw, 84px)",
          color: "var(--text-primary)",
        }}
      >
        Your adversarial{" "}
        <span style={{ color: "#9a9a9a" }}>Sentinel.</span>
      </h1>
      <p
        className="mx-auto mt-6 max-w-xl font-sans"
        style={{
          fontSize: "clamp(14px, 1.6vw, 18px)",
          lineHeight: 1.5,
          color: "var(--text-body)",
        }}
      >
        Alpha &amp; Oversight red-teams the market, detects the evasion, and
        codifies a new rule live — every handoff crossing the Band.
      </p>
    </div>
  );
}
