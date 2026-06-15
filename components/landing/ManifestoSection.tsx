"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

/**
 * ManifestoSection — the centered "statement" block that follows the
 * <KeyFigures/> stats band (AlphaLedger clone, themed for A&O).
 *
 * A LIGHT section (data-section="light", white bg, hard cut from the band
 * above). A small muted ◢ logomark sits centered at the top; below it, one
 * large centered statement is revealed WORD-BY-WORD from light-gray
 * (--text-faint) to ink (--text-primary) as the section scrolls through the
 * viewport center.
 *
 * Motion: a single framer-motion `useScroll` tracks the section's progress
 * across the viewport ("start 0.9" → "end 0.25"); each word maps a narrow,
 * overlapping slice of that 0→1 progress to a color interpolation via
 * `useTransform`, so the fill sweeps left→right as you scroll.
 *
 * Reduced-motion: the full statement renders in ink immediately (no scroll
 * animation, no per-word MotionValues consumed for color).
 *
 * Prop-less, self-contained, default export.
 */

const STATEMENT =
  "Alpha & Oversight reinvents surveillance as an adversarial craft. One desk invents the manipulation the market hasn't seen yet; another detects it, debates it across two model tiers, and proves the catch — every handoff crossing the Band, every verdict sealed in a hash-chained ledger, every novel evasion codified into a rule that can never be un-learned.";

const GRAY = "var(--text-faint)"; // #9a9a9a in the light theme
const INK = "var(--text-primary)"; // #14161c in the light theme

/** One word whose color fills gray→ink as the scroll progress passes its slice. */
function Word({
  word,
  index,
  total,
  progress,
}: {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // Each word owns an overlapping slice of [0,1]; later words start later so the
  // fill reads as a left→right sweep. The slice is widened slightly so adjacent
  // words crossfade rather than snap.
  const start = index / total;
  const end = (index + 1.4) / total;
  const color = useTransform(progress, [start, end], [GRAY, INK]);

  return (
    <motion.span style={{ color }} className="transition-colors">
      {word}{" "}
    </motion.span>
  );
}

export default function ManifestoSection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement | null>(null);

  // Drive the word fill off the section's travel through the viewport center.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.35"],
  });

  const words = STATEMENT.split(" ");

  return (
    <section
      data-section="light"
      aria-label="Manifesto"
      style={{
        backgroundColor: "var(--bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <div
        ref={ref}
        className="mx-auto flex flex-col items-center px-6 text-center"
        style={{
          maxWidth: 760,
          paddingTop: "20vh",
          paddingBottom: "20vh",
        }}
      >
        {/* ◢ logomark — small, muted, centered. A current-color bordered box
            rotated 45deg, color taken from --text-faint. */}
        <span
          aria-hidden="true"
          className="mb-12 inline-block"
          style={{
            width: 14,
            height: 14,
            border: "1.5px solid var(--text-faint)",
            transform: "rotate(45deg)",
            borderRadius: 2,
          }}
        />

        {/* The statement. */}
        <p
          className="font-sans"
          style={{
            fontSize: "clamp(26px, 3.4vw, 38px)",
            fontWeight: 300,
            lineHeight: 1.35,
            letterSpacing: "-0.01em",
          }}
        >
          {reduce
            ? // Reduced motion: full statement in ink, no scroll animation.
              STATEMENT
            : words.map((word, i) => (
                <Word
                  key={`${word}-${i}`}
                  word={word}
                  index={i}
                  total={words.length}
                  progress={scrollYProgress}
                />
              ))}
        </p>
      </div>
    </section>
  );
}
