"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

/**
 * OverviewSection — the "#overview" anchor: a self-drawing diagram of the two
 * desks coordinating THROUGH Band as one adversarial co-evolution loop.
 *
 * DARK section (not wrapped in data-section="light", so tokens resolve to dark
 * root values — band-blue glows). Layout left→right:
 *   R&D desk (red team, graphite --desk-rnd)
 *     → Band spine (centre, --band-blue — the visual hero, "coordinating")
 *       → Surveillance desk (blue team, slate --desk-surv)
 *         → CODIFY step (the new rule)
 *           → feedback edge looping BACK to R&D (the bar just rose).
 *
 * Motion: an inline SVG whose connector paths self-draw via framer `pathLength`
 * on `whileInView` (once); the desk / Band / codify nodes fade+rise in staggered
 * over the same in-view trigger. The Band spine and the feedback loop draw last
 * and a touch slower so the eye lands on the coordination + the closed loop.
 *
 * Reduced-motion: the full diagram renders immediately — paths at full length,
 * all nodes visible, no draw animation.
 *
 * Prop-less, self-contained, default export. id="overview" on the root section.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ── diagram geometry (viewBox 0 0 1000 420) ───────────────────────────────
   Three node columns on a baseline row (y≈150); the CODIFY pill sits to the
   right of Surveillance; the feedback edge sweeps along the bottom back to R&D. */
const NODE_W = 196;
const NODE_H = 96;
const ROW_Y = 116; // top of the desk/band node row
const NODE_CY = ROW_Y + NODE_H / 2;

const COL = {
  rnd: 70,
  band: 402,
  surv: 734,
};
const BAND_W = 196;

// CODIFY pill — sits below-right of Surveillance, on the return path.
const CODIFY = { x: 760, y: 268, w: 170, h: 56 };

/** Connector path defs (left→right flow + the bottom feedback loop). */
const PATHS = {
  // R&D → Band
  rndToBand: `M ${COL.rnd + NODE_W} ${NODE_CY} L ${COL.band} ${NODE_CY}`,
  // Band → Surveillance
  bandToSurv: `M ${COL.band + BAND_W} ${NODE_CY} L ${COL.surv} ${NODE_CY}`,
  // Surveillance → Codify (drop down to the pill)
  survToCodify: `M ${COL.surv + NODE_W / 2} ${ROW_Y + NODE_H} C ${
    COL.surv + NODE_W / 2
  } 230, ${CODIFY.x + CODIFY.w / 2} 230, ${CODIFY.x + CODIFY.w / 2} ${CODIFY.y}`,
  // Codify → back to R&D (the bar rises again): sweep along the bottom.
  feedback: `M ${CODIFY.x} ${CODIFY.y + CODIFY.h / 2} C 520 ${
    CODIFY.y + CODIFY.h / 2
  }, 360 360, ${COL.rnd + NODE_W / 2} 360 L ${COL.rnd + NODE_W / 2} ${
    ROW_Y + NODE_H
  }`,
};

type Step = {
  key: string;
  no: string;
  title: string;
  sub: string;
  x: number;
  tone: string; // node accent (stroke / label)
  fill: string; // node face
  hero?: boolean; // the Band spine
};

const STEPS: Step[] = [
  {
    key: "rnd",
    no: "01",
    title: "R&D desk",
    sub: "invents the evasion",
    x: COL.rnd,
    tone: "var(--desk-rnd)",
    fill: "var(--bg-card)",
  },
  {
    key: "band",
    no: "02",
    title: "Band spine",
    sub: "transmits sanitized flow",
    x: COL.band,
    tone: "var(--band-blue)",
    fill: "var(--band-blue-dim)",
    hero: true,
  },
  {
    key: "surv",
    no: "03",
    title: "Surveillance desk",
    sub: "detects · debates · resolves",
    x: COL.surv,
    tone: "var(--desk-surv)",
    fill: "var(--bg-card)",
  },
];

/** One desk / band node, drawn as foreignObject-free SVG so it scales with the
 *  viewBox. Fades + rises on the shared in-view trigger. */
function DeskNode({
  step,
  show,
  reduce,
  order,
}: {
  step: Step;
  show: boolean;
  reduce: boolean;
  order: number;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={show ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay: 0.12 + order * 0.14, ease: EASE }}
    >
      {/* hero glow halo behind the Band spine */}
      {step.hero && (
        <rect
          x={step.x - 8}
          y={ROW_Y - 8}
          width={NODE_W + 16}
          height={NODE_H + 16}
          rx={18}
          fill="none"
          stroke="var(--band-blue)"
          strokeWidth={1}
          opacity={0.28}
        />
      )}
      <rect
        x={step.x}
        y={ROW_Y}
        width={NODE_W}
        height={NODE_H}
        rx={14}
        fill={step.fill}
        stroke={step.tone}
        strokeWidth={step.hero ? 1.4 : 1}
        opacity={step.hero ? 1 : 0.95}
      />
      <text
        x={step.x + 18}
        y={ROW_Y + 28}
        className="font-mono"
        fontSize={12}
        letterSpacing="0.18em"
        fill={step.tone}
      >
        {step.no}
      </text>
      <text
        x={step.x + 18}
        y={ROW_Y + 56}
        className="font-sans"
        fontSize={19}
        fontWeight={400}
        fill="var(--text-primary)"
      >
        {step.title}
      </text>
      <text
        x={step.x + 18}
        y={ROW_Y + 78}
        className="font-sans"
        fontSize={12.5}
        fill="var(--text-muted)"
      >
        {step.sub}
      </text>
    </motion.g>
  );
}

/** A self-drawing connector. `pathLength` 0→1 on the shared in-view trigger. */
function Connector({
  d,
  show,
  reduce,
  delay,
  color,
  duration = 0.9,
  dashed = false,
  markerEnd,
}: {
  d: string;
  show: boolean;
  reduce: boolean;
  delay: number;
  color: string;
  duration?: number;
  dashed?: boolean;
  markerEnd: string;
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeDasharray={dashed ? "5 6" : undefined}
      markerEnd={markerEnd}
      initial={reduce ? false : { pathLength: 0, opacity: 0.2 }}
      animate={show ? { pathLength: 1, opacity: 1 } : undefined}
      transition={{
        pathLength: { duration, delay, ease: EASE },
        opacity: { duration: 0.25, delay },
      }}
    />
  );
}

export default function OverviewSection() {
  const reduce = useReducedMotion() ?? false;
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(diagramRef, { once: true, amount: 0.4 });
  const show = reduce || inView;

  return (
    <section
      id="overview"
      aria-labelledby="overview-title"
      style={{
        backgroundColor: "var(--bg-page)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="mx-auto px-6 pb-28 pt-24 sm:px-10 lg:pb-36 lg:pt-32"
        style={{ maxWidth: "var(--maxw-content)" }}
      >
        {/* header row: eyebrow + heading + paragraph (left), logomark anchor space */}
        <Reveal>
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "var(--band-blue)",
            }}
          >
            Overview
          </span>
        </Reveal>

        <MaskLines
          className="mt-5 font-sans"
          lineClassName=""
          lines={[
            <span key="l1" style={{ color: "var(--text-primary)" }}>
              Two desks.
            </span>,
            <span key="l2" style={{ color: "var(--text-faint)" }}>
              One adversarial loop.
            </span>,
          ]}
        />

        <Reveal delay={0.1}>
          <p
            className="mt-7 font-sans"
            style={{
              fontSize: "clamp(14px, 1.4vw, 16px)",
              lineHeight: 1.65,
              color: "var(--text-body)",
              maxWidth: 640,
            }}
          >
            Surveillance is a craft that never settles. R&D invents the evasion;{" "}
            <span style={{ color: "var(--band-blue)" }}>Band</span> transmits the
            sanitized order flow across the Chinese wall; Surveillance detects it,
            debates the inputs, and codifies a new deterministic rule. The bar
            rises — and R&D has to invent again. A closed loop, every handoff
            visible.
          </p>
        </Reveal>

        {/* ── the self-drawing diagram ─────────────────────────────────────── */}
        <div ref={diagramRef} className="mt-16 lg:mt-20">
          <svg
            viewBox="0 0 1000 420"
            className="h-auto w-full"
            role="img"
            aria-label="R&D desk transmits through the Band spine to the Surveillance desk, which codifies a new rule that loops back to raise the bar for R&D."
          >
            <defs>
              {/* arrowheads, tinted per edge */}
              {[
                ["arrow-rnd", "var(--desk-rnd)"],
                ["arrow-band", "var(--band-blue)"],
                ["arrow-surv", "var(--desk-surv)"],
                ["arrow-codify", "var(--verdict-escalate)"],
              ].map(([id, color]) => (
                <marker
                  key={id}
                  id={id}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 L10 5 L0 10 z" fill={color} />
                </marker>
              ))}
            </defs>

            {/* connectors (drawn under the nodes) */}
            <Connector
              d={PATHS.rndToBand}
              show={show}
              reduce={reduce}
              delay={0.5}
              color="var(--desk-rnd)"
              markerEnd="url(#arrow-rnd)"
            />
            {/* Band spine edges — the hero: brighter, drawn a touch slower */}
            <Connector
              d={PATHS.bandToSurv}
              show={show}
              reduce={reduce}
              delay={0.78}
              duration={1.05}
              color="var(--band-blue)"
              markerEnd="url(#arrow-band)"
            />
            <Connector
              d={PATHS.survToCodify}
              show={show}
              reduce={reduce}
              delay={1.1}
              color="var(--desk-surv)"
              markerEnd="url(#arrow-surv)"
            />
            {/* feedback loop — dashed, escalate-amber: "the bar rose, invent again" */}
            <Connector
              d={PATHS.feedback}
              show={show}
              reduce={reduce}
              delay={1.35}
              duration={1.15}
              color="var(--verdict-escalate)"
              dashed
              markerEnd="url(#arrow-codify)"
            />

            {/* CODIFY pill */}
            <motion.g
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={show ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.6, delay: 0.95, ease: EASE }}
            >
              <rect
                x={CODIFY.x}
                y={CODIFY.y}
                width={CODIFY.w}
                height={CODIFY.h}
                rx={12}
                fill="var(--bg-card-2)"
                stroke="var(--verdict-escalate)"
                strokeWidth={1}
              />
              <text
                x={CODIFY.x + 16}
                y={CODIFY.y + 24}
                className="font-mono"
                fontSize={11}
                letterSpacing="0.18em"
                fill="var(--verdict-escalate)"
              >
                04 · CODIFY
              </text>
              <text
                x={CODIFY.x + 16}
                y={CODIFY.y + 42}
                className="font-sans"
                fontSize={12.5}
                fill="var(--text-muted)"
              >
                new rule · 4 → 5
              </text>
            </motion.g>

            {/* desk / band nodes (drawn over the connectors) */}
            {STEPS.map((step, i) => (
              <DeskNode
                key={step.key}
                step={step}
                show={show}
                reduce={reduce}
                order={i}
              />
            ))}

            {/* feedback-edge caption — "raises the bar" */}
            <motion.text
              x={CODIFY.x - 28}
              y={CODIFY.y + CODIFY.h / 2 + 26}
              textAnchor="end"
              className="font-mono"
              fontSize={11}
              letterSpacing="0.14em"
              fill="var(--verdict-escalate)"
              initial={reduce ? false : { opacity: 0 }}
              animate={show ? { opacity: 0.85 } : undefined}
              transition={{ duration: 0.5, delay: 1.9, ease: EASE }}
            >
              raises the bar →
            </motion.text>
            {/* Chinese-wall marker on the R&D→Band edge */}
            <motion.text
              x={(COL.rnd + NODE_W + COL.band) / 2}
              y={NODE_CY - 12}
              textAnchor="middle"
              className="font-mono"
              fontSize={10.5}
              letterSpacing="0.14em"
              fill="var(--text-faint)"
              initial={reduce ? false : { opacity: 0 }}
              animate={show ? { opacity: 0.9 } : undefined}
              transition={{ duration: 0.5, delay: 1.6, ease: EASE }}
            >
              sanitized · events only
            </motion.text>
          </svg>
        </div>
      </div>
    </section>
  );
}
