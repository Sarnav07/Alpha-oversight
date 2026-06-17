"use client";

/**
 * AuditChainSection - the `#audit` section: the tamper-evident ledger as a COMPACT
 * diagonal STAIRCASE that fits in a single viewport (no internal scroll).
 *   • nine steps (one per role in the Overview nonagon) descend left→right,
 *     each block offset down + right so it reads as literal stairs;
 *   • the demo control + the verify_chain result sit on ONE row at opposite ends,
 *     so clicking "simulate an edit" visibly flips verify_chain ✓ → ✗ and recolours
 *     the staircase, all without scrolling;
 *   • no accidental hover-tamper - one clearly-labelled button drives the demo.
 *
 * Semantic colour only: --verdict-complete ✓, --verdict-flag for the edit,
 * --band-blue on Band-handoff steps. Reduced-motion renders the full staircase.
 * id="audit".
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";

import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Block = { i: number; agent: string; title: string; band?: boolean; prev: string; hash: string };

/* nine blocks - one per Band hop, mirroring the Overview nonagon */
const BLOCKS: Block[] = [
  { i: 0, agent: "adversary", title: "Order flow crossed", band: true, prev: "- genesis", hash: "0x8b1e…a3f9" },
  { i: 1, agent: "anomaly_detector", title: "Anomaly flagged", prev: "0x8b1e…a3f9", hash: "0x2c4a…11de" },
  { i: 2, agent: "investigator", title: "Recruited specialist", band: true, prev: "0x2c4a…11de", hash: "0x4d77…7c10" },
  { i: 3, agent: "specialist", title: "Evidence assembled", prev: "0x4d77…7c10", hash: "0x7a02…9b3c" },
  { i: 4, agent: "prosecution vs defense", title: "Case argued", prev: "0x7a02…9b3c", hash: "0xb5e1…42aa" },
  { i: 5, agent: "adjudicator", title: "Verdict reached", prev: "0xb5e1…42aa", hash: "0xc0aa…e904" },
  { i: 6, agent: "escalation_mgr", title: "Escalated to human", band: true, prev: "0xc0aa…e904", hash: "0x9f31…b27d" },
  { i: 7, agent: "human", title: "Human confirmed", prev: "0x9f31…b27d", hash: "0x3e88…1f60" },
  { i: 8, agent: "rule_engine", title: "New rule codified", prev: "0x3e88…1f60", hash: "0x1ed2…0f5c" },
];

const TAMPER_AT = 3;

/* ── compact staircase geometry - sized to fit one viewport ────────────────── */
const W = 212;
const H = 46;
const STEP_X = 104;
const STEP_Y = 50;
const PAD = 8;
const VB_W = PAD * 2 + (BLOCKS.length - 1) * STEP_X + W; // 1052
const VB_H = PAD * 2 + (BLOCKS.length - 1) * STEP_Y + H; // 584
const px = (i: number) => PAD + i * STEP_X;
const py = (i: number) => PAD + i * STEP_Y;

function SvgBlock({ b, broken, edited, show, reduce }: { b: Block; broken: boolean; edited: boolean; show: boolean; reduce: boolean }) {
  const x = px(b.i);
  const y = py(b.i);
  const accent = broken ? "var(--verdict-flag)" : "var(--verdict-pass)";
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.45, delay: 0.1 + b.i * 0.08, ease: EASE }}
    >
      <rect
        x={x}
        y={y}
        width={W}
        height={H}
        rx={11}
        fill={broken ? "color-mix(in srgb, var(--verdict-flag) 9%, var(--bg-card))" : "var(--bg-card)"}
        stroke={broken ? "var(--verdict-flag)" : "var(--border-subtle)"}
        strokeWidth={1}
      />
      {/* line 1: index + agent (+ band dot) */}
      <text x={x + 14} y={y + 19} className="font-mono" fontSize={12} fill="var(--text-primary)">
        <tspan fill="var(--text-faint)">{String(b.i).padStart(2, "0")} </tspan>
        <tspan fill={edited ? "var(--verdict-flag)" : "var(--text-primary)"}>{edited ? "✏ " : ""}{b.agent}</tspan>
      </text>
      {b.band && <circle cx={x + W - 16} cy={y + 15} r={3} fill="var(--band-blue)" />}
      {/* line 2: title + fingerprint */}
      <text x={x + 14} y={y + 37} className="font-sans" fontSize={10} fill="var(--text-muted)">
        {b.title}
      </text>
      <text x={x + W - 14} y={y + 37} textAnchor="end" className="font-mono" fontSize={9.5} fontWeight={500} fill={accent}>
        {b.hash}
      </text>
    </motion.g>
  );
}

function SvgConnector({ i, broken, show, reduce }: { i: number; broken: boolean; show: boolean; reduce: boolean }) {
  const sx = px(i) + 46;
  const sy = py(i) + H;
  const ex = px(i + 1) + 46;
  const ey = py(i + 1);
  const midY = sy + (ey - sy) / 2;
  const c = broken ? "var(--verdict-flag)" : "var(--verdict-pass)";
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0 }}
      animate={show ? { opacity: 1 } : reduce ? { opacity: 1 } : undefined}
      transition={{ duration: 0.4, delay: 0.16 + i * 0.08, ease: EASE }}
    >
      <path d={`M ${sx} ${sy} V ${midY} H ${ex} V ${ey}`} fill="none" stroke={c} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={broken ? "4 4" : undefined} opacity={0.85} />
      <circle cx={ex} cy={midY} r={7} fill="var(--bg-page)" stroke={broken ? "var(--verdict-flag)" : "var(--border-subtle)"} strokeWidth={1} />
      <g stroke={c} strokeWidth={1.3} fill="none" strokeLinecap="round" transform={`translate(${ex - 4.5} ${midY - 4.5}) scale(0.38)`}>
        <path d="M9 12h6" />
        <path d="M10 8.5h-1a3.5 3.5 0 0 0 0 7h1" />
        <path d="M14 8.5h1a3.5 3.5 0 0 1 0 7h-1" />
      </g>
    </motion.g>
  );
}

function MobileRow({ b, broken, edited }: { b: Block; broken: boolean; edited: boolean }) {
  const accent = broken ? "var(--verdict-flag)" : "var(--verdict-pass)";
  return (
    <div
      className="flex items-center justify-between rounded-[var(--r-card)] border px-3.5 py-2.5"
      style={{ backgroundColor: broken ? "color-mix(in srgb, var(--verdict-flag) 9%, var(--bg-card))" : "var(--bg-card)", borderColor: broken ? "var(--verdict-flag)" : "var(--border-subtle)" }}
    >
      <div className="min-w-0">
        <p className="truncate font-mono text-[11.5px]" style={{ color: edited ? "var(--verdict-flag)" : "var(--text-primary)" }}>
          <span className="text-[var(--text-faint)]">{String(b.i).padStart(2, "0")} </span>
          {edited ? "✏ " : ""}{b.agent}
          {b.band && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: "var(--band-blue)" }} />}
        </p>
        <p className="truncate font-sans text-[10.5px] text-[var(--text-muted)]">{b.title}</p>
      </div>
      <span className="shrink-0 pl-2 font-mono text-[9.5px]" style={{ color: accent }}>{b.hash}</span>
    </div>
  );
}

export default function AuditChainSection() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const show = reduce || inView;
  const [edited, setEdited] = useState(false);
  const isBroken = (i: number) => edited && i >= TAMPER_AT;

  return (
    <section id="audit" data-section="dark" className="relative w-full overflow-hidden bg-[var(--bg-page)] px-6 py-12 text-[var(--text-primary)] sm:px-10 lg:py-14">
      <div ref={ref} className="mx-auto max-w-[var(--maxw-content)]">
        {/* eyebrow */}
        <Reveal className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Audit</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">tamper-evident · append-only</span>
        </Reveal>

        {/* heading */}
        <MaskLines
          className="text-3xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-4xl lg:text-4xl"
          lines={[
            <span key="l1" className="text-[var(--text-primary)]">Every step,</span>,
            <span key="l2" className="text-[var(--text-muted)]">hash-chained.</span>,
          ]}
        />

        {/* one-line how-it-works */}
        <Reveal delay={0.1}>
          <p className="mt-3 max-w-3xl font-sans text-[14px] leading-relaxed text-[var(--text-body)]">
            The same nine steps from the loop above, sealed into a logbook - each block stamped with a{" "}
            <span className="text-[var(--text-primary)]">fingerprint</span> of the one before it. Change any record and every
            fingerprint below it stops matching.
          </p>
        </Reveal>

        {/* control bar - simulate (left) ⟷ verify_chain (right), one row */}
        <Reveal delay={0.16}>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-card)] border px-4 py-3" style={{ borderColor: "var(--border-subtle)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)" }}>
            <button
              type="button"
              onClick={() => setEdited((v) => !v)}
              className="inline-flex items-center gap-2 rounded-[var(--r-pill)] border px-4 py-2 font-mono text-[12px] transition-colors"
              style={{
                borderColor: edited ? "var(--verdict-flag)" : "var(--border-default)",
                color: edited ? "var(--verdict-flag)" : "var(--text-primary)",
                backgroundColor: edited ? "color-mix(in srgb, var(--verdict-flag) 10%, transparent)" : "transparent",
              }}
            >
              {edited ? `↺  Reset the ledger` : `▶  Simulate editing block #${String(TAMPER_AT).padStart(2, "0")}`}
            </button>

            <div className="flex items-center gap-2">
              <motion.span
                key={edited ? "broken" : "ok"}
                initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: edited ? "var(--verdict-flag)" : "var(--verdict-complete)", boxShadow: `0 0 8px ${edited ? "var(--verdict-flag)" : "var(--verdict-complete)"}` }}
              />
              <span className="font-mono text-[13px]" style={{ color: edited ? "var(--verdict-flag)" : "var(--verdict-complete)" }}>
                {edited ? "verify_chain ✗  tampering caught" : "verify_chain ✓  intact"}
              </span>
            </div>
          </div>
        </Reveal>

        {/* result line */}
        <Reveal delay={0.2}>
          <p className="mt-3 font-sans text-[12.5px] text-[var(--text-muted)]">
            {edited
              ? `Block #${String(TAMPER_AT).padStart(2, "0")} changed - its fingerprint no longer matches, so every block below it (in red) fails the check.`
              : "All 9 blocks re-hashed end to end - nothing has been altered. Try the button to see a tamper get caught."}
          </p>
        </Reveal>

        {/* desktop staircase */}
        <div className="mt-5 hidden md:block">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="mx-auto h-auto w-full" style={{ maxWidth: 1000 }} role="img" aria-label="A descending staircase of nine ledger blocks, each linked to the one above by a fingerprint.">
            {BLOCKS.slice(0, -1).map((b) => (
              <SvgConnector key={`c-${b.i}`} i={b.i} broken={isBroken(b.i)} show={show} reduce={reduce} />
            ))}
            {BLOCKS.map((b) => (
              <SvgBlock key={b.i} b={b} broken={isBroken(b.i)} edited={edited && b.i === TAMPER_AT} show={show} reduce={reduce} />
            ))}
          </svg>
        </div>

        {/* mobile vertical stack */}
        <div className="mt-6 flex flex-col gap-1.5 md:hidden">
          {BLOCKS.map((b) => (
            <MobileRow key={b.i} b={b} broken={isBroken(b.i)} edited={edited && b.i === TAMPER_AT} />
          ))}
        </div>
      </div>
    </section>
  );
}
