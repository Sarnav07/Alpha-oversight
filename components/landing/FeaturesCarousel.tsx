"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CommandCenterArt from "./CommandCenterArt";
import AuditChainArt from "./art/AuditChainArt";
import ThreatLeaderboardArt from "./art/ThreatLeaderboardArt";

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
  cta?: { label: string; href: string };
};

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
    cta: { label: "Enter Live Desk →", href: "/desk" },
  },
  {
    no: "02",
    icon: "❖",
    title: "Verified & Audited Lineage",
    body: "Every decision sealed in a hash-chained ledger. verify_chain ✓ — tamper-evident, audit-ready.",
    art: <AuditChainArt />,
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

/** A single large dark feature card. */
function FeatureCard({ card }: { card: Card }) {
  return (
    <article
      className="feat-card flex h-full shrink-0 flex-col overflow-hidden rounded-[var(--r-card)] border"
      style={{
        width: "min(76vw, 980px)",
        backgroundColor: "var(--bg-card-2)",
        borderColor: "var(--border-subtle)",
        boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
      }}
    >
      {/* Header band: icon + no + title + body (+ optional CTA) */}
      <div className="flex flex-col gap-4 p-7 sm:flex-row sm:items-start sm:justify-between sm:p-9">
        <div className="max-w-[560px]">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex items-center justify-center rounded-[10px] border text-[16px] text-[var(--text-primary)]"
              style={{
                width: 38,
                height: 38,
                borderColor: "var(--border-default)",
                backgroundColor: "var(--bg-inset)",
              }}
            >
              {card.icon}
            </span>
            <span className="font-mono text-[12px] tracking-[0.18em] text-[var(--text-faint)]">
              {card.no}
            </span>
          </div>
          <h3
            className="mt-5 font-sans"
            style={{
              fontSize: "clamp(22px, 2.4vw, 30px)",
              fontWeight: 300,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
            }}
          >
            {card.title}
          </h3>
          <p
            className="mt-3 font-sans"
            style={{
              fontSize: "clamp(13px, 1.4vw, 15px)",
              lineHeight: 1.55,
              color: "var(--text-body)",
            }}
          >
            {card.body}
          </p>
        </div>

        {card.cta ? (
          <Link
            href={card.cta.href}
            className="inline-flex shrink-0 items-center self-start rounded-[var(--r-pill)] border px-4 py-2 font-sans text-[13px] font-medium transition-colors"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--frost)",
              color: "var(--obsidian)",
            }}
          >
            {card.cta.label}
          </Link>
        ) : null}
      </div>

      {/* Screenshot / art region — fills the remaining height. */}
      <div
        className="relative mx-7 mb-7 flex-1 overflow-hidden rounded-[10px] border sm:mx-9 sm:mb-9"
        style={{
          borderColor: "var(--hairline)",
          backgroundColor: "var(--obsidian)",
          minHeight: 0,
        }}
      >
        <div className="absolute inset-0">{card.art}</div>
      </div>
    </article>
  );
}

/** The section-anchor header — shared by both render paths. */
function FeaturesHeader() {
  return (
    <div className="px-6 sm:px-10">
      <div
        className="flex items-center justify-between pb-5 pt-8"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Features
        </span>
        <span
          aria-hidden="true"
          className="inline-block"
          style={{
            width: 14,
            height: 14,
            border: "1.5px solid var(--text-faint)",
            transform: "rotate(45deg)",
            borderRadius: 2,
            opacity: 0.6,
          }}
        />
      </div>
      <div className="mt-8 flex items-end justify-between gap-6">
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
  // Runway height needed so vertical scroll ≈ horizontal track travel.
  const [runway, setRunway] = useState<number | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    // Reduced motion: do not build the pinned timeline at all.
    if (mq.matches) return;

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
  }, []);

  // ── Reduced-motion / no-pin static fallback ─────────────────────────────
  if (reduced === true) {
    return (
      <section
        aria-label="Our Features"
        style={{
          backgroundColor: "var(--bg-page)",
          color: "var(--text-primary)",
        }}
      >
        <div className="mx-auto" style={{ maxWidth: "var(--maxw-content)" }}>
          <FeaturesHeader />
        </div>
        {/* Native horizontal scroller — same cards, no pinning. */}
        <div
          className="flex gap-6 overflow-x-auto px-6 pb-16 pt-12 sm:px-10"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {CARDS.map((card) => (
            <div
              key={card.no}
              className="h-[68vh] min-h-[520px]"
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
        backgroundColor: "var(--bg-page)",
      }}
    >
      {/* Sticky stage — pinned for the duration of the horizontal scroll. */}
      <div
        className="feat-stage sticky top-0 flex h-screen w-full flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-page)",
          color: "var(--text-primary)",
        }}
      >
        <div className="mx-auto w-full" style={{ maxWidth: "var(--maxw-content)" }}>
          <FeaturesHeader />
        </div>

        {/* Horizontal track — translated on x by the scrubbed timeline. */}
        <div className="relative flex-1">
          <div
            ref={trackRef}
            className="absolute left-0 top-0 flex h-full items-center gap-6 pl-6 pr-[8vw] will-change-transform sm:gap-8 sm:pl-10"
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
