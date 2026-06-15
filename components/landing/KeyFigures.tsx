"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * KeyFigures — the closing "Key Figures" stats band (frame-4 reveal).
 *
 * AlphaLedger-style LIGHT section (data-section="light", white bg, ink text)
 * with a hard cut from the dark Command Center dashboard above it. A centered
 * light-weight title sits over a row of big MONO count-up figures, each with an
 * uppercase tracked label. A thin hairline-topped eyebrow strip closes it out.
 *
 * Prop-less, self-contained. Numbers count up from 0 when scrolled into view;
 * "4 → 5" is a static stylized figure (not numeric). Respects
 * prefers-reduced-motion by rendering final values immediately.
 */

type Figure = {
  /** numeric target to count toward, or null for a static stylized value */
  to: number | null;
  /** value shown verbatim when `to` is null */
  staticValue?: string;
  prefix?: string;
  suffix?: string;
  /** decimal places to render while counting */
  decimals?: number;
  label: string;
};

const FIGURES: Figure[] = [
  { to: 847, suffix: "", decimals: 0, label: "Alerts triaged" },
  { to: 72, suffix: "%", decimals: 0, label: "False positives blocked" },
  {
    to: 41.2,
    suffix: "h",
    decimals: 1,
    label: "Analyst-hours saved · wk",
  },
  { to: null, staticValue: "4 → 5", label: "Rules codified live" },
];

const COUNT_MS = 1400;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

/** Single count-up (or static) figure cell. */
function FigureCell({
  figure,
  start,
  reduce,
}: {
  figure: Figure;
  start: boolean;
  reduce: boolean;
}) {
  const isStatic = figure.to === null;
  const [value, setValue] = useState(
    isStatic || reduce ? (figure.to ?? 0) : 0,
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isStatic || reduce) {
      if (figure.to !== null) setValue(figure.to);
      return;
    }
    if (!start) return;

    const target = figure.to as number;
    const t0 = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - t0) / COUNT_MS, 1);
      setValue(target * EASE_OUT(p));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [start, isStatic, reduce, figure.to]);

  const display = isStatic
    ? figure.staticValue
    : `${figure.prefix ?? ""}${value.toFixed(figure.decimals ?? 0)}${
        figure.suffix ?? ""
      }`;

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="font-mono tabular-nums"
        style={{
          fontSize: "clamp(40px, 6vw, 60px)",
          fontWeight: 300,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          // reserve digits so settling values don't shift layout
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display}
      </span>
      <span
        className="mt-4 font-sans"
        style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "var(--text-muted)",
        }}
      >
        {figure.label}
      </span>
    </div>
  );
}

export default function KeyFigures() {
  const reduce = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement | null>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.4 });
  const start = reduce || inView;

  return (
    <section
      ref={sectionRef}
      data-section="light"
      aria-labelledby="key-figures-title"
      style={{
        backgroundColor: "var(--bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="mx-auto px-6 py-24 sm:py-32"
        style={{ maxWidth: "var(--maxw-content)" }}
      >
        {/* Title */}
        <motion.h2
          id="key-figures-title"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={start ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center font-sans"
          style={{
            fontSize: "clamp(34px, 5vw, 52px)",
            fontWeight: 300,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          Key Figures
        </motion.h2>

        {/* Figures row */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={start ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 grid grid-cols-2 gap-y-14 gap-x-8 sm:gap-x-12 lg:mt-20 lg:grid-cols-4 lg:gap-x-8"
        >
          {FIGURES.map((figure) => (
            <FigureCell
              key={figure.label}
              figure={figure}
              start={start}
              reduce={reduce}
            />
          ))}
        </motion.div>

        {/* Eyebrow strip with hairline top border */}
        <div
          className="mt-20 pt-6 text-center lg:mt-24"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "var(--text-muted)",
            }}
          >
            Verify the market · Codify the threat
          </span>
        </div>
      </div>
    </section>
  );
}
