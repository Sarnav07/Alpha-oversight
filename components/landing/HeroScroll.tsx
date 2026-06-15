"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import LandingNav from "./LandingNav";
import CommandCenterArt from "./CommandCenterArt";
import Logomark from "@/components/landing/Logomark";

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
      const keys = q(".hero-keys");
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
      // The device is tilted back in 3D (rotateX) so screen + bezel both read as
      // a real laptop lid. rotateX animates → 0 (upright) as the scroll zooms in.
      gsap.set(stage, { backgroundColor: "#ffffff" });
      gsap.set(device, {
        yPercent: 46,
        scale: 0.8,
        rotateX: 18,
        transformOrigin: "50% 82%",
        transformPerspective: 1600,
      });
      gsap.set(bezel, { opacity: 1, scale: 1 });
      gsap.set(keys, { opacity: 1, yPercent: 0 });
      gsap.set(heroText, { opacity: 1, y: 0 });
      gsap.set(cookie, { opacity: 1, y: 0 });
      gsap.set(play, { opacity: 0, scale: 0.7 });

      // Reference choreography = an Apple-style "dive INTO the screen": the app
      // flattens to head-on EARLY and grows OUT of the laptop to full-bleed while
      // the device frame (keyboard, bezel) sweeps / expands away — NOT a uniform
      // scale-up with a late bezel fade.

      // FRAME 1 hold: 0.00–0.14 — tilted laptop peeking, headline + cookie.
      tl.to({}, { duration: 0.14 });

      // 0.14–0.30 — RISE + FLATTEN: headline + cookie clear; the laptop rises to
      // centre and UN-TILTS fully head-on (rotateX → 0) by 0.30, the app filling
      // the bezel. (Reference: the UI is flat & head-on by ~30%.)
      tl.to(cookie, { opacity: 0, y: 24, duration: 0.1 }, 0.14);
      tl.to(heroText, { opacity: 0, y: -44, duration: 0.12 }, 0.14);
      tl.to(arrow, { opacity: 0, duration: 0.08 }, 0.14);
      tl.to(
        device,
        { yPercent: 0, scale: 1.0, rotateX: 0, duration: 0.16, ease: "power2.out" },
        0.14,
      );

      // 0.30–0.40 — bg crossfades white → obsidian; the play button blinks.
      tl.to(stage, { backgroundColor: "#020202", duration: 0.18 }, 0.3);
      tl.to(play, { opacity: 1, scale: 1, duration: 0.08 }, 0.31);
      tl.to(play, { opacity: 0, scale: 1.3, duration: 0.1 }, 0.42);

      // 0.30–0.56 — THE BURST: the app grows out of the device to full-bleed. The
      // keyboard slides down & out; the bezel rim EXPANDS outward past the
      // viewport edges (scale > 1) as it fades — so the app reads as coming OUT of
      // the laptop, not the laptop scaling uniformly. scale 1.0 → 1.3 makes the
      // 78vh screen fill the full viewport height head-on.
      tl.to(keys, { yPercent: 130, opacity: 0, duration: 0.12, ease: "power1.in" }, 0.3);
      tl.to(device, { scale: 1.3, duration: 0.26, ease: "power1.inOut" }, 0.3);
      tl.to(bezel, { scale: 1.14, opacity: 0, duration: 0.16, ease: "power1.in" }, 0.4);

      // 0.56–1.00 — END STATE: full-bleed head-on dashboard with a slow continued
      // scale for life. Kept OPAQUE (no fade to black) so the pin releases on a
      // readable frame and <KeyFigures/> hard-cuts to white directly below.
      tl.to(device, { scale: 1.42, duration: 0.44, ease: "none" }, 0.56);

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

          {/* The device (laptop). A perspective WRAPPER holds the 3D-tilted
              .hero-device: a thin-bezel aluminium lid wrapping the dark inset
              SCREEN (CommandCenterArt), plus a keyboard BASE/hinge hinted at the
              bottom. rotateX tilts the lid back in 3D; it animates → upright and
              scales to full-bleed across frames 2→3. */}
          <div
            className="relative z-10 h-[78vh] w-[min(1180px,92vw)]"
            style={{ perspective: "1600px", perspectiveOrigin: "50% 55%" }}
          >
            <div
              className="hero-device relative h-full w-full"
              style={{ transformStyle: "preserve-3d", willChange: "transform" }}
            >
            {/* keyboard base / hinge — a silver aluminium slab hinted just below
                the lid, giving the tilted laptop a 3D footprint. Fades out as the
                lid rises upright into full-bleed (frame 2). */}
            <div
              className="hero-keys absolute inset-x-[-3%] bottom-[-7.2%] z-0 h-[8.4%] rounded-b-[14px] rounded-t-[4px]"
              style={{
                background:
                  "linear-gradient(180deg, #d4d7dc 0%, #a8acb4 40%, #75797f 100%)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.6) inset, 0 30px 70px rgba(0,0,0,0.4)",
              }}
            >
              {/* hinge notch (lid-open recess) at top-center of the base */}
              <div
                className="hero-base absolute left-1/2 top-0 h-[34%] w-[18%] -translate-x-1/2 rounded-b-[7px]"
                style={{ backgroundColor: "rgba(0,0,0,0.34)" }}
              />
              {/* trackpad cutout hint */}
              <div
                className="absolute left-1/2 bottom-[12%] h-[26%] w-[26%] -translate-x-1/2 rounded-[4px]"
                style={{
                  backgroundColor: "rgba(0,0,0,0.10)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.4) inset",
                }}
              />
            </div>

            {/* bezel — the laptop lid: thin aluminium rim around a dark screen.
                Fades to 0 in frame 3 so the dashboard reads full-bleed. */}
            <div
              className="hero-bezel absolute inset-0 z-10 rounded-[18px] border bg-[var(--obsidian)]"
              style={{
                borderColor: "rgba(255,255,255,0.18)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.12) inset, 0 0 0 1px rgba(0,0,0,0.6), 0 50px 130px rgba(0,0,0,0.5)",
              }}
            >
              {/* webcam dot, centered on the top bezel */}
              <div
                className="absolute left-1/2 top-[7px] h-[3px] w-[3px] -translate-x-1/2 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.24)" }}
              />
            </div>

            {/* screen — the actual dashboard art, inset inside the bezel */}
            <div className="absolute inset-[11px] z-20 overflow-hidden rounded-[10px] bg-[var(--obsidian)]">
              <CommandCenterArt />
            </div>

            {/* cookie consent card (FRAME 1) — dark, overlaid low-left on the
                screen, matching the AlphaLedger reference. Dismisses on the
                0.16–0.30 beat. */}
            <div className="hero-cookie absolute bottom-[8%] left-[5%] z-30 w-[min(460px,64%)]">
              <div
                className="rounded-[16px] border p-5 shadow-2xl backdrop-blur"
                style={{
                  backgroundColor: "rgba(8,8,9,0.92)",
                  borderColor: "rgba(255,255,255,0.10)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Logomark size={16} className="text-[var(--frost)]" />
                  <span
                    className="font-sans text-[15px]"
                    style={{ fontWeight: 300, color: "var(--frost)" }}
                  >
                    We Use Cookies
                  </span>
                </div>
                <p
                  className="font-sans text-[11.5px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  We use cookies to calibrate surveillance thresholds, analyze
                  Band traffic, and remember your desk. By continuing you agree
                  to our use of cookies. Check our Cookie Policy for details.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    className="rounded-[var(--r-pill)] px-5 py-2 font-sans text-[12px] font-medium"
                    style={{
                      backgroundColor: "var(--frost)",
                      color: "var(--obsidian)",
                    }}
                  >
                    Accept all
                  </button>
                  <button
                    type="button"
                    className="rounded-[var(--r-pill)] border px-5 py-2 font-sans text-[12px]"
                    style={{
                      borderColor: "rgba(255,255,255,0.22)",
                      color: "var(--frost)",
                    }}
                  >
                    Reject all
                  </button>
                </div>
              </div>
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
    <div className="text-center">
      <h1
        className="font-sans"
        style={{
          fontWeight: 420,
          letterSpacing: "-0.012em",
          lineHeight: 1.04,
          // Sized so the longest variant ("Your adversarial Adversary.") stays on
          // ONE line at desktop widths; shrinks on narrow viewports.
          fontSize: "clamp(30px, 5.4vw, 72px)",
          color: "var(--text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        Your adversarial <RotatingWord />
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

/**
 * RotatingWord — the headline's trailing clause, cycling through A&O's roles on
 * a ~2s timer (AlphaLedger rotates "Companion" → "Audit" → …). Rendered in the
 * muted two-tone gray. Under prefers-reduced-motion the word stays fixed on
 * "Sentinel." with no animation. AnimatePresence cross-fades each swap.
 */
const ROTATING_WORDS = ["Sentinel.", "Adversary.", "Auditor."] as const;

function RotatingWord() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  // Reserve horizontal space so the headline doesn't reflow on swap.
  const ch = Math.max(...ROTATING_WORDS.map((w) => w.length));

  if (reduceMotion) {
    return <span style={{ color: "#9a9a9a" }}>{ROTATING_WORDS[0]}</span>;
  }

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        minWidth: `${ch}ch`,
        textAlign: "left",
        verticalAlign: "bottom",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          initial={{ opacity: 0, y: "0.18em" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "-0.18em" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: "inline-block",
            color: "#9a9a9a",
            whiteSpace: "nowrap",
          }}
        >
          {ROTATING_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
