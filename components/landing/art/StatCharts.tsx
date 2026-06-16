"use client";

import { motion } from "framer-motion";

/**
 * StatCharts — the three bespoke monochrome mini-charts that sit under each
 * stat in <WhySection/> (the A&O analog of AlphaLedger's "Why …" proof charts).
 *
 * House rules honoured:
 *  - monochrome backbone (white/gray on obsidian); the ONLY accent is the
 *    semantic --verdict-complete dot on the audit-proof chart. NEVER --band-blue.
 *  - deterministic geometry (no Math.random) so SSR == client (no hydration drift).
 *  - each chart takes `start` (reveal trigger) + `reduce` (prefers-reduced-motion):
 *    on reduce it renders the FINAL state immediately, no motion.
 *
 * Shared viewBox 220×96; baseline y=86, usable band 8…86.
 */

const W = 220;
const BASE = 86;
const TOP = 8;
const UH = BASE - TOP; // usable height
const X0 = 6;
const XW = W - X0 * 2;

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/** value (0=bottom … 1=top) → svg y */
const y = (v: number) => BASE - v * UH;
/** index over N → svg x */
const x = (i: number, n: number) => X0 + (i * XW) / (n - 1);

/** straight polyline through values */
function linePath(vs: number[]): string {
  return vs.map((v, i) => `${i ? "L" : "M"}${x(i, vs.length).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
}
/** smooth (quadratic midpoint) path through values */
function smoothPath(vs: number[]): string {
  const pts = vs.map((v, i) => [x(i, vs.length), y(v)] as const);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const mx = (px + cx) / 2;
    const my = (py + cy) / 2;
    d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
}
const areaFrom = (line: string, vs: number[]) =>
  `${line} L${x(vs.length - 1, vs.length).toFixed(1)} ${BASE} L${X0} ${BASE} Z`;

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} 96`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {children}
    </svg>
  );
}

/* ── 1 · detection signals — a volatile bar field ──────────────────────────── */
const BARS = [0.4, 0.62, 0.34, 0.7, 0.5, 0.85, 0.46, 0.6, 0.78, 0.52, 0.9, 0.66, 0.82];

export function BarSignal({ start, reduce }: { start: boolean; reduce: boolean }) {
  const n = BARS.length;
  const slot = XW / n;
  const bw = slot * 0.54;
  return (
    <Svg>
      <line x1={X0} y1={BASE} x2={W - X0} y2={BASE} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {BARS.map((v, i) => {
        const bx = X0 + i * slot + (slot - bw) / 2;
        const bh = v * UH;
        return (
          <motion.rect
            key={i}
            x={bx}
            y={BASE - bh}
            width={bw}
            height={bh}
            rx={1.5}
            style={{ transformBox: "fill-box", transformOrigin: "bottom", fill: "var(--frost)", opacity: 0.18 + v * 0.5 }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={start ? { scaleY: 1 } : reduce ? { scaleY: 1 } : { scaleY: 0 }}
            transition={{ duration: 0.5, delay: 0.05 + i * 0.035, ease: EASE }}
          />
        );
      })}
    </Svg>
  );
}

/* ── 2 · rulebook ramp — jagged line trending up, area under ───────────────── */
const RAMP = [0.3, 0.42, 0.36, 0.55, 0.48, 0.4, 0.62, 0.7, 0.6, 0.78, 0.72, 0.9, 0.86];

export function AreaRamp({ start, reduce }: { start: boolean; reduce: boolean }) {
  const line = linePath(RAMP);
  return (
    <Svg>
      <defs>
        <linearGradient id="sc-ramp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaFrom(line, RAMP)}
        fill="url(#sc-ramp)"
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : reduce ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--frost)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.85 }}
        initial={reduce ? false : { pathLength: 0 }}
        animate={start ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.1, ease: EASE }}
      />
    </Svg>
  );
}

/* ── 3 · audit proof — smooth rise + verified annotation at the peak ────────── */
const PROOF = [0.2, 0.24, 0.3, 0.28, 0.36, 0.45, 0.5, 0.62, 0.7, 0.66, 0.78, 0.88, 0.95];

export function AreaProof({ start, reduce }: { start: boolean; reduce: boolean }) {
  const line = smoothPath(PROOF);
  const px = x(PROOF.length - 1, PROOF.length);
  const py = y(PROOF[PROOF.length - 1]);
  return (
    <Svg>
      <defs>
        <linearGradient id="sc-proof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaFrom(line, PROOF)}
        fill="url(#sc-proof)"
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : reduce ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--frost)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.85 }}
        initial={reduce ? false : { pathLength: 0 }}
        animate={start ? { pathLength: 1 } : reduce ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      {/* crosshair + verified annotation at the final point */}
      <motion.g
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={start ? { opacity: 1, y: 0 } : reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 1.0, ease: EASE }}
      >
        <line x1={px} y1={TOP} x2={px} y2={BASE} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="2 3" />
        <circle cx={px} cy={py} r="3.2" fill="var(--obsidian)" stroke="var(--verdict-complete)" strokeWidth="1.6" />
        <g transform={`translate(${px - 86}, ${TOP - 2})`}>
          <rect width="78" height="18" rx="4" fill="rgba(10,11,13,0.92)" stroke="rgba(255,255,255,0.14)" />
          <circle cx="9" cy="9" r="2.4" style={{ fill: "var(--verdict-complete)" }} />
          <text x="17" y="12.5" style={{ fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }} fontSize="8.5" letterSpacing="0.5">
            block #1287 ✓
          </text>
        </g>
      </motion.g>
    </Svg>
  );
}
