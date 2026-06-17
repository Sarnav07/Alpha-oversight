"use client";

import { motion } from "framer-motion";

/**
 * BandNonagon - the presentational SVG of the "Band at the centre" nonagon: nine
 * roles on a 9-sided ring, every side a Band hop, the deterministic codify hop
 * closing the loop back to the adversary. Extracted from OverviewSection so the
 * exact same diagram (the landing "#overview" art) can also fill the hero laptop
 * screen (HeroSplitArt) without diverging.
 *
 * Pure presentation: no hooks of its own - the caller supplies `show` (start the
 * self-draw) and `reduce` (render the final state immediately, reduced-motion).
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Tone = "rnd" | "surv" | "codify" | "human";
type Role = {
  id: string;
  name: string;
  role: string;
  hopN: string;
  hop: string;
  tone: Tone;
  tier: string;
  feedback?: boolean;
  wall?: boolean;
};

/* the nine roles in loop order (one per nonagon vertex); `hop` = the artifact
   this node SENDS over Band to the next node. */
const ROLES: Role[] = [
  { id: "adversary", name: "adversary", role: "invents the evasion", hopN: "01", hop: "sanitized flow", tone: "rnd", tier: "open-weight", wall: true },
  { id: "anomaly_detector", name: "anomaly_detector", role: "scans the tape", hopN: "02", hop: "anomaly · score", tone: "surv", tier: "open" },
  { id: "investigator", name: "investigator", role: "opens the case", hopN: "03", hop: "recruit · family", tone: "surv", tier: "open" },
  { id: "specialist", name: "specialist", role: "builds evidence", hopN: "04", hop: "evidence", tone: "surv", tier: "open" },
  { id: "debate", name: "prosecution ⚔ defense", role: "adversarial debate", hopN: "05", hop: "argued case", tone: "surv", tier: "frontier ⚔ open" },
  { id: "adjudicator", name: "adjudicator", role: "resolves the debate", hopN: "06", hop: "resolved_inputs", tone: "surv", tier: "open" },
  { id: "escalation_manager", name: "escalation_mgr", role: "escalates the novel", hopN: "07", hop: "escalation packet", tone: "surv", tier: "frontier" },
  { id: "human", name: "human", role: "confirms the catch", hopN: "08", hop: "confirm", tone: "human", tier: "in-the-loop" },
  { id: "rule_engine", name: "rule_engine", role: "codifies · 4 → 5", hopN: "09", hop: "new rule 4→5", tone: "codify", tier: "deterministic", feedback: true },
];

const toneColor: Record<Tone, string> = {
  rnd: "var(--desk-rnd)",
  surv: "var(--desk-surv)",
  codify: "var(--verdict-escalate)",
  human: "var(--text-faint)",
};

/* ── nonagon geometry (viewBox 0 0 1120 900) - a wide ellipse-laid 9-gon ───── */
const CX = 560;
const CY = 460;
const RX = 372;
const RY = 300;
const CARD_W = 172;
const CARD_H = 66;
const rad = (d: number) => (d * Math.PI) / 180;
const PTS = ROLES.map((r, i) => {
  const a = -90 + i * 40; // 360/9 = 40°, clockwise from top
  return { ...r, i, a, x: CX + RX * Math.cos(rad(a)), y: CY + RY * Math.sin(rad(a)) };
});
const BAND_D = "M " + PTS.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
const CLOSE_D = `M ${PTS[8].x.toFixed(1)} ${PTS[8].y.toFixed(1)} L ${PTS[0].x.toFixed(1)} ${PTS[0].y.toFixed(1)}`;
const ARROWS = PTS.map((p, i) => {
  const q = PTS[(i + 1) % 9];
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
  return { mx, my, ang, feedback: i === 8 };
});

function AgentCard({ node, show, reduce }: { node: (typeof PTS)[number]; show: boolean; reduce: boolean }) {
  const tone = toneColor[node.tone];
  const x = node.x - CARD_W / 2;
  const y = node.y - CARD_H / 2;
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0 }}
      animate={show ? { opacity: 1 } : undefined}
      transition={{ duration: 0.5, delay: 0.5 + node.i * 0.09, ease: EASE }}
    >
      <rect x={x} y={y} width={CARD_W} height={CARD_H} rx={13} fill="var(--bg-card)" stroke={tone} strokeWidth={1} />
      <circle cx={x + CARD_W - 15} cy={y + 15} r={3} fill={tone} />
      <text x={x + 14} y={y + 24} className="font-mono" fontSize={12.5} fill="var(--text-primary)">
        {node.name}
      </text>
      <text x={x + 14} y={y + 41} className="font-sans" fontSize={10.5} fill="var(--text-muted)">
        {node.role}
      </text>
      <text x={x + 14} y={y + 58} className="font-mono" fontSize={9.5} fill={node.feedback ? "var(--verdict-escalate)" : "var(--band-blue)"}>
        {node.hopN} → {node.hop}
      </text>
    </motion.g>
  );
}

export function BandNonagon({
  show,
  reduce,
  className = "h-auto w-full",
}: {
  show: boolean;
  reduce: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 112 1120 680"
      className={className}
      role="img"
      aria-label="A nonagon of nine roles around Band at the centre: adversary hands the sanitized order flow across the Chinese wall to anomaly_detector, investigator, specialist, the prosecution and defense debate, adjudicator, escalation_manager, a human, and the deterministic rule engine, which codifies a new rule that loops back to the adversary. Each side is a Band message."
    >
      <defs>
        <marker id="non-arrow-band" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--band-blue)" />
        </marker>
      </defs>

      {/* faint spokes - every role binds to Band at the hub */}
      {PTS.map((p) => (
        <motion.line
          key={`spoke-${p.id}`}
          x1={CX}
          y1={CY}
          x2={p.x}
          y2={p.y}
          stroke="var(--band-blue)"
          strokeWidth={1}
          strokeDasharray="2 7"
          initial={reduce ? false : { opacity: 0 }}
          animate={show ? { opacity: 0.12 } : undefined}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
      ))}

      {/* nonagon sides (the eight forward Band hops) - self-draw */}
      <motion.path
        d={BAND_D}
        fill="none"
        stroke="var(--band-blue)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        opacity={0.85}
        initial={reduce ? false : { pathLength: 0 }}
        animate={show ? { pathLength: 1 } : undefined}
        transition={{ duration: 1.5, delay: 0.4, ease: EASE }}
      />
      {/* closing side - the codify feedback (amber, dashed) */}
      <motion.path
        d={CLOSE_D}
        fill="none"
        stroke="var(--verdict-escalate)"
        strokeWidth={1.5}
        strokeDasharray="5 6"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={show ? { pathLength: 1 } : undefined}
        transition={{ duration: 1, delay: 1.5, ease: EASE }}
      />
      {/* directional arrowheads at each side midpoint */}
      {ARROWS.map((a, i) => (
        <motion.path
          key={`arr-${i}`}
          d="M -5 -4 L 5 0 L -5 4 Z"
          transform={`translate(${a.mx.toFixed(1)} ${a.my.toFixed(1)}) rotate(${a.ang.toFixed(1)})`}
          fill={a.feedback ? "var(--verdict-escalate)" : "var(--band-blue)"}
          initial={reduce ? false : { opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ duration: 0.4, delay: 0.7 + i * 0.12, ease: EASE }}
        />
      ))}

      {/* Chinese-wall marker on side 01 (adversary → anomaly_detector) */}
      <motion.text
        x={(PTS[0].x + PTS[1].x) / 2 + 6}
        y={(PTS[0].y + PTS[1].y) / 2 - 14}
        textAnchor="middle"
        className="font-mono"
        fontSize={9.5}
        letterSpacing="0.12em"
        fill="var(--text-faint)"
        initial={reduce ? false : { opacity: 0 }}
        animate={show ? { opacity: 0.85 } : undefined}
        transition={{ duration: 0.5, delay: 1.4 }}
      >
        ⟂ Chinese wall
      </motion.text>

      {/* centre - Band */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={show ? { opacity: 1 } : undefined}
        transition={{ duration: 0.6, delay: 0.9, ease: EASE }}
      >
        <circle cx={CX} cy={CY} r={104} fill="none" stroke="var(--band-blue)" strokeWidth={1} opacity={0.3} />
        <circle cx={CX} cy={CY - 36} r={4} fill="var(--band-blue)" />
        <text aria-hidden="true" x={CX} y={CY + 18} textAnchor="middle" className="font-mono" fontSize={34} letterSpacing="0.16em" fill="var(--band-blue)">
          BAND
        </text>
      </motion.g>

      {/* role cards on the vertices */}
      {PTS.map((p) => (
        <AgentCard key={p.id} node={p} show={show} reduce={reduce} />
      ))}
    </svg>
  );
}

export default BandNonagon;
