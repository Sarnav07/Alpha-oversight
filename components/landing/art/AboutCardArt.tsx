"use client";

import { motion } from "framer-motion";

/**
 * AboutCardArt — the four bespoke monochrome visuals for <MoreAboutSection/>'s
 * bento cards (A&O analog of AlphaLedger's "Features" grid glyphs):
 *   RadarSearch  · 01 Adversarial R&D       — radar rings sweeping a search lens
 *   DetectRing   · 02 Surveillance Desk      — a segmented agent ring + center stat
 *   AuditShield  · 03 Tamper-evident Audit   — hatch field, shield, hash-block chip
 *   BandScan     · 04 Cross-desk Band        — concentric scan arcs + desk nodes
 *
 * House rules: monochrome (white/gray on near-black); the ONLY accent is the
 * semantic --verdict-complete dot on the audit chip. NEVER --band-blue.
 * Deterministic (no Math.random) so SSR == client. Each takes `start` (the card
 * has entered view) + `reduce` (prefers-reduced-motion → final state, no motion).
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const MONO = "var(--font-mono)";

/** polar point on a circle (angle in degrees, 0° = +x, clockwise in svg) */
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
/** arc path from a0→a1 degrees at radius r */
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function Svg({ vb, children, className }: { vb: string; children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox={vb} className={className ?? "h-full w-full"} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {children}
    </svg>
  );
}

/* ── 01 · radar + search lens ──────────────────────────────────────────────── */
export function RadarSearch({ start, reduce }: { start: boolean; reduce: boolean }) {
  const cx = 250;
  const cy = 150;
  const show = (d: number) => ({
    initial: reduce ? false : { opacity: 0, scale: 0.85 },
    animate: start ? { opacity: 1, scale: 1 } : reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 },
    transition: { duration: 0.7, delay: reduce ? 0 : d, ease: EASE },
  });
  return (
    <Svg vb="0 0 360 300">
      {[150, 108, 66].map((r, i) => (
        <motion.circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" style={{ transformBox: "fill-box", transformOrigin: "center" }} {...show(0.05 * i)} />
      ))}
      {/* sweep wedge */}
      <motion.path
        d={`M${cx} ${cy} L${polar(cx, cy, 150, -60)[0].toFixed(1)} ${polar(cx, cy, 150, -60)[1].toFixed(1)} A150 150 0 0 1 ${polar(cx, cy, 150, -18)[0].toFixed(1)} ${polar(cx, cy, 150, -18)[1].toFixed(1)} Z`}
        fill="rgba(255,255,255,0.05)"
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : { opacity: reduce ? 1 : 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
      />
      {/* floating glyph chips */}
      {[
        { x: 196, y: 70, g: "M-4 3 L-1 -1 L1 1 L4 -3" },
        { x: 320, y: 120, g: "M0 -4 A4 4 0 1 1 -0.1 -4 M0 0 L2 2" },
        { x: 168, y: 196, g: "M-4 3 L-2 0 L0 2 L3 -3" },
      ].map((c, i) => (
        <motion.g key={i} {...show(0.15 + i * 0.08)}>
          <circle cx={c.x} cy={c.y} r="15" fill="rgba(14,15,18,0.9)" stroke="rgba(255,255,255,0.12)" />
          <path d={c.g} transform={`translate(${c.x} ${c.y})`} fill="none" stroke="var(--frost)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        </motion.g>
      ))}
      {/* search lens */}
      <motion.g {...show(0.3)}>
        <circle cx={cx} cy={cy} r="32" fill="rgba(10,11,13,0.92)" stroke="var(--frost)" strokeWidth="1.6" />
        <circle cx={cx - 3} cy={cy - 3} r="11" fill="none" stroke="var(--frost)" strokeWidth="2" />
        <line x1={cx + 5} y1={cy + 5} x2={cx + 13} y2={cy + 13} stroke="var(--frost)" strokeWidth="2" strokeLinecap="round" />
      </motion.g>
    </Svg>
  );
}

/* ── 02 · segmented agent ring + center stat ───────────────────────────────── */
const NODES = [-90, -30, 30, 90, 150, 210];
export function DetectRing({ start, reduce }: { start: boolean; reduce: boolean }) {
  const cx = 130;
  const cy = 130;
  const R = 92;
  const gap = 13; // degrees of gap around each node
  return (
    <Svg vb="0 0 260 260">
      {/* faint outer + inner guides */}
      <circle cx={cx} cy={cy} r={R + 16} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      {/* segmented ring (between consecutive nodes) */}
      {NODES.map((a, i) => {
        const next = NODES[(i + 1) % NODES.length] + (i === NODES.length - 1 ? 360 : 0);
        return (
          <motion.path
            key={i}
            d={arc(cx, cy, R, a + gap, next - gap)}
            fill="none"
            stroke="var(--frost)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ opacity: 0.5 }}
            initial={reduce ? false : { pathLength: 0 }}
            animate={start ? { pathLength: 1 } : { pathLength: reduce ? 1 : 0 }}
            transition={{ duration: 0.7, delay: reduce ? 0 : 0.1 + i * 0.07, ease: EASE }}
          />
        );
      })}
      {/* agent nodes */}
      {NODES.map((a, i) => {
        const [nx, ny] = polar(cx, cy, R, a);
        return (
          <motion.g
            key={`n${i}`}
            initial={reduce ? false : { opacity: 0, scale: 0.5 }}
            animate={start ? { opacity: 1, scale: 1 } : { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.5 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : 0.3 + i * 0.07, ease: EASE }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <circle cx={nx} cy={ny} r="13" fill="rgba(12,13,16,0.95)" stroke="rgba(255,255,255,0.18)" />
            <circle cx={nx} cy={ny} r="3" style={{ fill: "var(--text-muted)" }} />
          </motion.g>
        );
      })}
      {/* center stat */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 1 } : { opacity: reduce ? 1 : 0 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : 0.5, ease: EASE }}
      >
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="30" style={{ fill: "var(--frost)", fontFamily: MONO }} letterSpacing="-1">
          14
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9.5" letterSpacing="0.5" style={{ fill: "var(--text-muted)", fontFamily: MONO }}>
          agents · 2 tiers
        </text>
      </motion.g>
    </Svg>
  );
}

/* ── 03 · hatch field + shield + hash-block chip ───────────────────────────── */
export function AuditShield({ start, reduce }: { start: boolean; reduce: boolean }) {
  // deterministic diagonal hatch strokes
  const hatch: { x: number; y: number }[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) hatch.push({ x: 40 + c * 46, y: 36 + r * 52 });
  return (
    <Svg vb="0 0 360 300">
      {/* hatch */}
      {hatch.map((h, i) => (
        <motion.line
          key={i}
          x1={h.x} y1={h.y} x2={h.x + 14} y2={h.y - 20}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.4"
          strokeLinecap="round"
          initial={reduce ? false : { opacity: 0 }}
          animate={start ? { opacity: 1 } : { opacity: reduce ? 1 : 0 }}
          transition={{ duration: 0.5, delay: reduce ? 0 : (i % 7) * 0.03 + Math.floor(i / 7) * 0.05, ease: EASE }}
        />
      ))}
      {/* hash-block credential chip */}
      <motion.g
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={start ? { opacity: 1, y: 0 } : { opacity: reduce ? 1 : 0, y: reduce ? 0 : 10 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : 0.4, ease: EASE }}
      >
        <rect x="150" y="196" width="172" height="64" rx="12" fill="rgba(12,13,16,0.92)" stroke="rgba(255,255,255,0.14)" />
        <rect x="166" y="214" width="28" height="28" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)" />
        <circle cx="180" cy="225" r="4.5" fill="none" stroke="var(--frost)" strokeWidth="1.4" />
        <path d="M172 237 a8 6 0 0 1 16 0" fill="none" stroke="var(--frost)" strokeWidth="1.4" />
        <rect x="206" y="218" width="92" height="5" rx="2.5" fill="rgba(255,255,255,0.22)" />
        <rect x="206" y="230" width="70" height="5" rx="2.5" fill="rgba(255,255,255,0.12)" />
        <g transform="translate(290 248)">
          <circle r="6" style={{ fill: "var(--verdict-complete)" }} opacity="0.18" />
          <circle r="2.4" style={{ fill: "var(--verdict-complete)" }} />
        </g>
      </motion.g>
    </Svg>
  );
}

/* ── 04 · concentric scan arcs + desk nodes ────────────────────────────────── */
export function BandScan({ start, reduce }: { start: boolean; reduce: boolean }) {
  const cx = 300;
  const cy = 300;
  return (
    <Svg vb="0 0 360 300">
      {[60, 110, 160, 210].map((r, i) => (
        <motion.path
          key={r}
          d={arc(cx, cy, r, 182, 268)}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={i === 1 ? 2 : 1.3}
          strokeLinecap="round"
          style={{ opacity: 0.9 - i * 0.16 }}
          initial={reduce ? false : { pathLength: 0 }}
          animate={start ? { pathLength: 1 } : { pathLength: reduce ? 1 : 0 }}
          transition={{ duration: 0.9, delay: reduce ? 0 : 0.1 + i * 0.1, ease: EASE }}
        />
      ))}
      {/* desk nodes riding the arcs */}
      {[
        { r: 110, a: 200 },
        { r: 160, a: 230 },
        { r: 210, a: 255 },
      ].map((n, i) => {
        const [nx, ny] = polar(cx, cy, n.r, n.a);
        return (
          <motion.circle
            key={i}
            cx={nx}
            cy={ny}
            r="4.5"
            fill="var(--obsidian)"
            stroke="var(--frost)"
            strokeWidth="1.5"
            initial={reduce ? false : { opacity: 0, scale: 0 }}
            animate={start ? { opacity: 1, scale: 1 } : { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : 0.5 + i * 0.1, ease: EASE }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        );
      })}
      <motion.circle
        cx={cx}
        cy={cy}
        r="6"
        style={{ fill: "var(--frost)" }}
        initial={reduce ? false : { opacity: 0 }}
        animate={start ? { opacity: 0.9 } : { opacity: reduce ? 0.9 : 0 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 0.2, ease: EASE }}
      />
    </Svg>
  );
}
