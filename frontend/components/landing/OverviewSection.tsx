"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

/**
 * OverviewSection - the "#overview" anchor: a NONAGON of every role on the two
 * desks, with Band at the centre. Nine nodes sit on a 9-sided ring; the nine
 * sides are the nine Band hops, each carrying a structured artifact, forming one
 * closed adversarial loop. Replaces a linear box-row so a reviewer cannot read it
 * as "two agents pass a message" - Band is literally the hub every role binds to.
 *
 * Ring order (clockwise from top): adversary (R&D, open-weight) ─cross-wall─▶
 * anomaly_detector → investigator → specialist → prosecution ⚔ defense →
 * adjudicator → escalation_manager → human → rule_engine ─codify─▶ back to
 * adversary. Each node card lists its OUTGOING Band message.
 *
 * DARK section. Desktop renders the self-drawing nonagon; below md a stacked
 * hop list takes over. Reduced-motion renders the final state.
 *
 * Prop-less, self-contained, default export. id="overview".
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ── the nine roles in loop order (one per nonagon vertex) ──────────────────
   `hop` is the artifact this node SENDS over Band to the next node. */
type Tone = "rnd" | "surv" | "codify" | "human";
type Role = { id: string; name: string; role: string; hopN: string; hop: string; tone: Tone; tier: string; feedback?: boolean; wall?: boolean };
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

/* mobile list rows (full payloads) */
const HOPS = [
  { n: "01", from: "adversary", to: "anomaly_detector", via: "sanitized order flow", kind: "wall" as const },
  { n: "02", from: "anomaly_detector", to: "investigator", via: "anomaly · score" },
  { n: "03", from: "investigator", to: "specialist", via: "recruit · family" },
  { n: "04", from: "specialist", to: "prosecution ⚔ defense", via: "evidence · candidate_inputs" },
  { n: "05", from: "prosecution ⚔ defense", to: "adjudicator", via: "argued case" },
  { n: "06", from: "adjudicator", to: "escalation_manager", via: "verdict · resolved_inputs" },
  { n: "07", from: "escalation_manager", to: "human", via: "escalation packet" },
  { n: "08", from: "human", to: "rule_engine", via: "confirm" },
  { n: "09", from: "rule_engine", to: "adversary", via: "new rule 4→5 · raises the bar", kind: "feedback" as const },
];

const LEGEND: { label: string; tone: string }[] = [
  { label: "R&D · open-weight", tone: "var(--desk-rnd)" },
  { label: "Surveillance · open + frontier", tone: "var(--desk-surv)" },
  { label: "Band · coordination + audit", tone: "var(--band-blue)" },
  { label: "Rule engine · deterministic", tone: "var(--verdict-escalate)" },
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
// the open band path (8 sides p0→p8) + the amber closing side (p8→p0)
const BAND_D = "M " + PTS.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
const CLOSE_D = `M ${PTS[8].x.toFixed(1)} ${PTS[8].y.toFixed(1)} L ${PTS[0].x.toFixed(1)} ${PTS[0].y.toFixed(1)}`;
// arrowhead at each side midpoint, oriented along the side (clockwise flow)
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

function HopList({ show, reduce }: { show: boolean; reduce: boolean }) {
  return (
    <ol className="flex flex-col gap-px overflow-hidden rounded-2xl" style={{ border: "1px solid var(--hairline)" }}>
      {HOPS.map((h, i) => (
        <motion.li
          key={h.n}
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={show ? { opacity: 1, x: 0 } : reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
          transition={{ duration: 0.4, delay: 0.05 + i * 0.05, ease: EASE }}
          className="flex flex-col gap-1 px-4 py-3.5"
          style={{ backgroundColor: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-2 font-mono" style={{ fontSize: 12 }}>
            <span style={{ color: h.kind === "feedback" ? "var(--verdict-escalate)" : "var(--band-blue)" }}>{h.n}</span>
            <span style={{ color: "var(--text-primary)" }}>{h.from}</span>
            <span aria-hidden="true" style={{ color: "var(--text-faint)" }}>→</span>
            <span style={{ color: "var(--text-primary)" }}>{h.to}</span>
          </div>
          <div className="flex items-center gap-1.5 pl-6 font-mono" style={{ fontSize: 11, color: h.kind === "feedback" ? "var(--verdict-escalate)" : "var(--band-blue)" }}>
            <span style={{ color: "var(--text-muted)" }}>{h.kind === "wall" ? "cross-wall · via Band" : h.kind === "feedback" ? "co-evolution" : "via Band"}</span>
            <span aria-hidden="true" style={{ color: "var(--text-faint)" }}>·</span>
            <span>{h.via}</span>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

export default function OverviewSection() {
  const reduce = useReducedMotion() ?? false;
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(diagramRef, { once: true, amount: 0.2 });
  const show = reduce || inView;
  const listRef = useRef<HTMLDivElement | null>(null);
  const listInView = useInView(listRef, { once: true, amount: 0.15 });
  const showList = reduce || listInView;

  return (
    <section id="overview" className="relative z-50" aria-labelledby="overview-title" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}>
      <div className="mx-auto px-6 pb-28 pt-24 sm:px-10 lg:pb-36 lg:pt-32" style={{ maxWidth: "var(--maxw-content)" }}>
        {/* header */}
        <Reveal>
          <span className="font-mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--band-blue)" }}>
            Overview
          </span>
        </Reveal>

        <MaskLines
          className="mt-5 font-sans"
          lineClassName=""
          lines={[
            <span key="l1" id="overview-title" style={{ color: "var(--text-primary)" }}>
              Nine roles, one loop.
            </span>,
            <span key="l2" style={{ color: "var(--text-faint)" }}>
              Band at the centre of every hand-off.
            </span>,
          ]}
        />

        <Reveal delay={0.1}>
          <p className="mt-7 font-sans" style={{ fontSize: "clamp(14px, 1.4vw, 16px)", lineHeight: 1.65, color: "var(--text-body)", maxWidth: 700 }}>
            No role talks to another directly. Eight specialised agents, a human in the loop, and a deterministic rule engine sit on a
            nonagon - and every artifact between them (the cross-wall order flow, the recruit, the evidence, the verdict, the escalation
            packet) rides <span style={{ color: "var(--band-blue)" }}>Band</span>, the hub at the centre and the hash-chained audit anchor.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-2 font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.tone }} />
                {l.label}
              </li>
            ))}
          </ul>
        </Reveal>

        {/* ── desktop nonagon (md+) ───────────────────────────────────────── */}
        <div ref={diagramRef} className="mt-8 hidden md:block">
          <svg
            viewBox="0 112 1120 680"
            className="h-auto w-full"
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

          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 text-center font-mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-muted)" }}>
              9 roles · 1 medium · hash-chained
            </p>
            <p className="mx-auto mt-2 text-center font-mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
              9 roles = 8 agents + the rule engine; the human confirms.
            </p>
            <p className="mx-auto mt-3 text-center font-mono" style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--text-faint)", maxWidth: 760 }}>
              Every side is a real Band message (handoff.send → POST /agent/chats/&#123;room&#125;/messages), bound into the hash-chained
              ledger - handoff layer, structured-context channel, sole cross-wall bridge, and audit anchor. Not a wrapper, not a
              notification.
            </p>
          </Reveal>
        </div>

        {/* ── mobile list (below md) ──────────────────────────────────────── */}
        <div ref={listRef} className="mt-10 md:hidden">
          <HopList show={showList} reduce={reduce} />
          <p className="mt-6 font-mono" style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-faint)" }}>
            Every hop is a real Band message bound into the hash-chained ledger - the handoff layer, structured-context channel, sole
            cross-wall bridge, and audit anchor.
          </p>
        </div>
      </div>
    </section>
  );
}
