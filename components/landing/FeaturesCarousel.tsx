"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CommandCenterArt from "./CommandCenterArt";
import AuditChainArt from "./art/AuditChainArt";
import ThreatLeaderboardArt from "./art/ThreatLeaderboardArt";
import Logomark from "@/components/landing/Logomark";
import { useIsMobile } from "./useIsMobile";

gsap.registerPlugin(ScrollTrigger);

/**
 * FeaturesCarousel — the pinned "Our Features" horizontal-scroll carousel
 * (AlphaLedger clone, themed for A&O). A DARK section with a hard cut from the
 * light <ManifestoSection/> above it.
 *
 * Layout: an outer runway whose height equals the horizontal track's scroll
 * distance, so 1px of vertical scroll maps to ~1px of horizontal travel. A
 * sticky stage is PINNED for the duration; inside it a fixed section-anchor
 * header (hairline divider, "FEATURES" eyebrow + faint ◢ logomark, "Our
 * Features" heading, "← SCROLL" cue) sits over a horizontal TRACK of four large
 * dark cards. As the user scrolls down, a scrubbed GSAP timeline translates the
 * track on x from 0 → -(trackScrollWidth - viewportWidth), so cards march
 * right→left.
 *
 * The GSAP setup MATCHES <HeroScroll/>: gsap.registerPlugin(ScrollTrigger);
 * useLayoutEffect + gsap.context scoped to the root ref; a
 * window.matchMedia('(prefers-reduced-motion: reduce)') branch that skips the
 * pin; return ctx.revert() cleanup.
 *
 * Reduced-motion / no-pin fallback: the track renders as a NATIVE
 * overflow-x-auto scroller (no pinning) with the same cards — still usable.
 *
 * Prop-less, self-contained, default export.
 */

type Card = {
  no: string;
  icon: string;
  title: string;
  body: string;
  art: React.ReactNode;
  /** When true the device frame shows a centered ▶ play affordance. */
  play?: boolean;
  cta?: { label: string; href: string };
};

/**
 * A circular ▶ play affordance overlaid on the device art (centered). Purely
 * decorative — mirrors the AlphaLedger feature-card play button.
 */
function PlayButton() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex items-center justify-center rounded-full backdrop-blur-sm"
      style={{
        width: 56,
        height: 56,
        transform: "translate(-50%, -50%)",
        backgroundColor: "rgba(254,254,254,0.14)",
        border: "1px solid rgba(254,254,254,0.4)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M5 3.5L14 9L5 14.5V3.5Z" fill="var(--frost)" />
      </svg>
    </span>
  );
}

/**
 * LaptopFrame — a reusable angled MacBook-style device frame (bezel + base)
 * wrapping a card's art region, with an optional ▶ play overlay. The screen is
 * tilted slightly to read as a real device rising into the card, matching the
 * AlphaLedger reference. `play` toggles the centered play affordance.
 */
function LaptopFrame({
  children,
  play = false,
}: {
  children: React.ReactNode;
  play?: boolean;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        className="relative"
        style={{
          width: "112%",
          maxWidth: 760,
          transform: "perspective(1600px) rotateY(-12deg) rotateX(3deg)",
          transformOrigin: "left center",
        }}
      >
        {/* Lid — bezel + screen */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: 14,
            padding: 10,
            backgroundColor: "#0b0b0c",
            border: "1px solid var(--border-default)",
            boxShadow:
              "0 40px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Camera notch */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-[5px] z-10 inline-block rounded-full"
            style={{
              width: 5,
              height: 5,
              transform: "translateX(-50%)",
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          />
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 7,
              backgroundColor: "var(--obsidian)",
              border: "1px solid var(--hairline)",
              aspectRatio: "16 / 10.2",
            }}
          >
            <div className="absolute inset-0">{children}</div>
            {play ? <PlayButton /> : null}
          </div>
        </div>
        {/* Base / hinge — a thin slab beneath the lid */}
        <div
          aria-hidden="true"
          className="relative mx-auto"
          style={{
            width: "104%",
            left: "-2%",
            height: 12,
            marginTop: 3,
            borderRadius: "0 0 10px 10px",
            background:
              "linear-gradient(180deg, #141416 0%, #0a0a0b 60%, #050505 100%)",
            border: "1px solid var(--border-subtle)",
            borderTop: "none",
            boxShadow: "0 18px 30px rgba(0,0,0,0.5)",
          }}
        >
          {/* hinge indent */}
          <span
            className="absolute left-1/2 top-0 inline-block rounded-b"
            style={{
              width: "16%",
              height: 4,
              transform: "translateX(-50%)",
              backgroundColor: "#000",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Inline art for card 3 — two dossier mini-cards across the two model tiers. */
function CrossModelArt() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-4 p-6 sm:gap-6 sm:p-10">
      {/* Prosecution — frontier (gold) */}
      <DossierCard
        badge="▸ frontier"
        badgeColor="var(--tier-frontier)"
        role="Prosecution"
        deskColor="var(--desk-rnd)"
        quote="Layered orders at 09:31:04 seeded a phantom book; the cancel-burst at 09:31:06 confirms intent to mislead."
      />
      {/* swords */}
      <span
        aria-hidden="true"
        className="shrink-0 font-sans text-[20px] leading-none text-[var(--text-faint)] sm:text-[26px]"
      >
        ⚔
      </span>
      {/* Defense — open (gray) */}
      <DossierCard
        badge="▸ open"
        badgeColor="var(--tier-open)"
        role="Defense"
        deskColor="var(--desk-surv)"
        quote="Cancels are within venue latency norms; absent a fill-rate anomaly the pattern is consistent with routine quoting."
      />
    </div>
  );
}

function DossierCard({
  badge,
  badgeColor,
  role,
  deskColor,
  quote,
}: {
  badge: string;
  badgeColor: string;
  role: string;
  deskColor: string;
  quote: string;
}) {
  return (
    <div
      className="flex h-full max-w-[320px] flex-1 flex-col rounded-[var(--r-card)] border p-5 sm:p-6"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-[11px] font-medium"
          style={{ color: badgeColor }}
        >
          {badge}
        </span>
        <span
          aria-hidden="true"
          className="inline-block"
          style={{
            width: 10,
            height: 10,
            backgroundColor: deskColor,
            borderRadius: 2,
            opacity: 0.85,
          }}
        />
      </div>
      <span
        className="mt-4 font-sans text-[12px] uppercase tracking-[0.18em] text-[var(--text-muted)]"
      >
        {role}
      </span>
      <p
        className="mt-3 font-mono text-[13px] leading-relaxed text-[var(--text-body)]"
        style={{ flex: 1 }}
      >
        “{quote}”
      </p>
    </div>
  );
}

const CARDS: Card[] = [
  {
    no: "01",
    icon: "◈",
    title: "Live Trace Analytics",
    body: "Every agent step streams in real time — topology, model badges, verdicts, the blue waiting-on-Band node.",
    art: <CommandCenterArt />,
    play: true,
    cta: { label: "Enter Live Desk →", href: "/desk" },
  },
  {
    no: "02",
    icon: "❖",
    title: "Verified & Audited Lineage",
    body: "Every decision sealed in a hash-chained ledger. verify_chain ✓ — tamper-evident, audit-ready.",
    art: <AuditChainArt />,
    play: true,
  },
  {
    no: "03",
    icon: "⚔",
    title: "Cross-Model Contest",
    body: "Prosecution (frontier) ⚔ Defense (open) argue the same evidence across two model tiers.",
    art: <CrossModelArt />,
  },
  {
    no: "04",
    icon: "⬡",
    title: "The Codify Engine",
    body: "A confirmed evasion becomes a deterministic rule in < 3s — regression-gated.",
    art: <ThreatLeaderboardArt />,
  },
];

/**
 * A single large dark feature card — AlphaLedger layout: a LEFT text column
 * (outline icon, title, body, optional CTA pill anchored to the lower-left) and
 * a RIGHT device-framed art region with an optional ▶ play affordance.
 *
 * Cards flagged `play` show their art inside an angled <LaptopFrame/>; the
 * others present the art in a flat bordered "framed region".
 */
function FeatureCard({ card }: { card: Card }) {
  const framed = card.play ? (
    <LaptopFrame play>{card.art}</LaptopFrame>
  ) : (
    <div
      className="relative h-full w-full overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "var(--hairline)",
        backgroundColor: "var(--obsidian)",
        boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
      }}
    >
      <div className="absolute inset-0">{card.art}</div>
    </div>
  );

  return (
    <article
      className="feat-card flex h-full shrink-0 flex-col overflow-hidden rounded-[var(--r-card)] border md:grid md:grid-rows-[auto] md:[grid-template-columns:minmax(0,0.86fr)_minmax(0,1.14fr)]"
      style={{
        // Mobile (native swipe): a near-full-width card. md+ (pinned track):
        // the original 60vw cinematic width.
        width: "min(86vw, 860px)",
        backgroundColor: "var(--bg-card-2)",
        borderColor: "var(--border-subtle)",
        boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
      }}
    >
      {/* LEFT — text column. Icon top-left, title + body, CTA pill lower-left. */}
      <div className="flex flex-col p-7 sm:p-9 md:h-full">
        <div>
          <span
            aria-hidden="true"
            className="flex items-center justify-center rounded-[10px] border text-[16px] text-[var(--text-primary)]"
            style={{
              width: 40,
              height: 40,
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-inset)",
            }}
          >
            {card.icon}
          </span>
          <span className="mt-4 block font-mono text-[11px] tracking-[0.18em] text-[var(--text-faint)]">
            {card.no}
          </span>
        </div>

        {/* Title + body anchored toward the lower portion of the column. */}
        <div className="mt-auto pt-8">
          <h3
            className="font-sans"
            style={{
              fontSize: "clamp(24px, 2.6vw, 34px)",
              fontWeight: 300,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
            }}
          >
            {card.title}
          </h3>
          <p
            className="mt-3 max-w-[42ch] font-sans"
            style={{
              fontSize: "clamp(13px, 1.4vw, 15px)",
              lineHeight: 1.55,
              color: "var(--text-body)",
            }}
          >
            {card.body}
          </p>

          {card.cta ? (
            <Link
              href={card.cta.href}
              className="mt-7 inline-flex items-center self-start rounded-[var(--r-pill)] px-5 py-2.5 font-sans text-[13px] font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: "var(--frost)",
                color: "var(--obsidian)",
              }}
            >
              {card.cta.label}
            </Link>
          ) : null}
        </div>
      </div>

      {/* RIGHT — device-framed art region with the ▶ play affordance. On mobile
          (stacked) it gets an explicit min height so the device frame reads;
          md+ it fills the grid cell. */}
      <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden px-7 pb-7 sm:px-9 sm:pb-9 md:h-full md:min-h-0 md:px-0 md:py-9 md:pr-9">
        {framed}
      </div>
    </article>
  );
}

/** The section-anchor header — shared by both render paths. */
function FeaturesHeader() {
  // data-section="light" remaps the monochrome tokens to their light-theme
  // values, so the eyebrow / heading / hairline / logomark read DARK on the
  // white section (the cards below stay dark — they sit outside this wrapper).
  return (
    <div data-section="light" className="px-6 pt-16 sm:px-10">
      <div
        className="flex items-center justify-between pt-4"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Features
        </span>
        <span aria-hidden="true" style={{ opacity: 0.55 }}>
          <Logomark size={16} className="text-[var(--text-faint)]" />
        </span>
      </div>
      <div className="mt-14 flex items-end justify-between gap-6">
        <h2
          className="font-sans"
          style={{
            fontSize: "clamp(34px, 5vw, 56px)",
            fontWeight: 300,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          Our Features
        </h2>
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)] sm:inline">
          ← Scroll
        </span>
      </div>
    </div>
  );
}

export default function FeaturesCarousel() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // null = undecided (SSR/first paint), true/false once measured on the client
  const [reduced, setReduced] = useState<boolean | null>(null);
  // Below md the pinned horizontal scroll becomes a native swipe stack.
  const isMobile = useIsMobile();
  // Runway height needed so vertical scroll ≈ horizontal track travel.
  const [runway, setRunway] = useState<number | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    // Reduced motion OR a small viewport: do not build the pinned timeline at
    // all (the native horizontal scroller renders instead).
    if (mq.matches || window.matchMedia("(max-width: 767px)").matches) return;

    const ctx = gsap.context((self) => {
      const q = self.selector!;
      const stage = q(".feat-stage")[0] as HTMLElement;
      const track = trackRef.current;
      if (!stage || !track) return;

      // The distance the track must travel = its overflow beyond the viewport.
      const distance = () =>
        Math.max(0, track.scrollWidth - window.innerWidth);

      // Size the runway so 1px vertical ≈ 1px horizontal travel (+1 viewport so
      // the last card holds on-screen before the pin releases).
      const setRunwayHeight = () =>
        setRunway(distance() + window.innerHeight);
      setRunwayHeight();

      gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top top",
          end: () => `+=${distance()}`,
          scrub: true,
          pin: stage,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      const onResize = () => setRunwayHeight();
      window.addEventListener("resize", onResize);
      ScrollTrigger.refresh();

      // Clean up the resize listener alongside ctx.revert().
      self.add(() => window.removeEventListener("resize", onResize));
    }, rootRef);

    return () => ctx.revert();
    // Re-run when the mobile boundary is crossed so the pin builds/tears down.
  }, [isMobile]);

  // ── No-pin fallback (reduced-motion OR mobile) ──────────────────────────
  if (reduced === true || isMobile === true) {
    return (
      <section
        aria-label="Our Features"
        style={{
          backgroundColor: "#ffffff",
          color: "#14161c",
        }}
      >
        <div className="mx-auto" style={{ maxWidth: "var(--maxw-content)" }}>
          <FeaturesHeader />
        </div>
        {/* Native horizontal scroller — same cards, no pinning. Cards auto-size
            their height on mobile (stacked content) and take the cinematic tall
            frame from sm+ (side-by-side grid). */}
        <div
          className="flex gap-6 overflow-x-auto px-6 pb-16 pt-12 sm:px-10"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {CARDS.map((card) => (
            <div
              key={card.no}
              className="sm:h-[68vh] sm:min-h-[520px]"
              style={{ scrollSnapAlign: "start" }}
            >
              <FeatureCard card={card} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── Motion (and pre-measure) render ─────────────────────────────────────
  return (
    <div
      ref={rootRef}
      className="relative"
      style={{
        height: runway != null ? `${runway}px` : "300vh",
        backgroundColor: "#ffffff",
      }}
    >
      {/* Sticky stage — pinned for the duration of the horizontal scroll. */}
      <div
        className="feat-stage sticky top-0 flex h-screen w-full flex-col overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          color: "#14161c",
        }}
      >
        <div className="mx-auto w-full" style={{ maxWidth: "var(--maxw-content)" }}>
          <FeaturesHeader />
        </div>

        {/* Horizontal track — translated on x by the scrubbed timeline. */}
        <div className="relative flex-1">
          <div
            ref={trackRef}
            className="absolute left-0 top-0 flex h-full items-center gap-6 pr-[8vw] will-change-transform sm:gap-8"
            style={{
              // Inset the first card so it aligns with the "Our Features"
              // heading (the centered max-width container), not the viewport edge.
              paddingLeft:
                "max(calc((100vw - var(--maxw-content)) / 2 + 2.5rem), 2.5rem)",
            }}
          >
            {CARDS.map((card) => (
              <div key={card.no} className="h-[78%] py-2">
                <FeatureCard card={card} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
