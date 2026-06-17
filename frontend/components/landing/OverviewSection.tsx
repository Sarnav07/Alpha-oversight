"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";
import BandNonagon from "./BandNonagon";

/**
 * OverviewSection - the "#overview" anchor: a NONAGON of every role on the two
 * desks, with Band at the centre. Nine nodes sit on a 9-sided ring; the nine
 * sides are the nine Band hops, each carrying a structured artifact, forming one
 * closed adversarial loop. Replaces a linear box-row so a reviewer cannot read it
 * as "two agents pass a message" - Band is literally the hub every role binds to.
 *
 * The desktop nonagon SVG lives in the shared `BandNonagon` component (also used
 * to fill the hero laptop screen via HeroSplitArt). DARK section. Below md a
 * stacked hop list takes over. Reduced-motion renders the final state.
 *
 * Prop-less, self-contained, default export. id="overview".
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

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
          <BandNonagon show={show} reduce={reduce} />

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
