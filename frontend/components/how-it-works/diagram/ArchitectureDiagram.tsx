"use client";

/**
 * D1 - the system architecture, recreated natively (report Fig 1). Two desks
 * across the Chinese wall on the Band spine; the gold rule engine holds sole
 * verdict authority; the hash-chained ledger seals every message. Self-draws on
 * scroll-into-view; band-blue marks only the Band hops. Dark "ops" stage.
 */

import { motion } from "framer-motion";
import { DiagramFrame, Node, EngineNode, Edge, Chip, Tag, EASE } from "./kit";

function DeskFrame({
  x,
  y,
  w,
  h,
  label,
  tone,
  show,
  reduce,
  delay,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tone: string;
  show: boolean;
  reduce: boolean;
  delay: number;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0 }}
      animate={show ? { opacity: 1 } : undefined}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      <rect x={x} y={y} width={w} height={h} rx={16} fill="color-mix(in srgb, var(--band-blue) 2%, transparent)" stroke={tone} strokeWidth={1} strokeDasharray="2 6" opacity={0.7} />
      <text x={x + 16} y={y + 24} className="font-mono" fontSize={12} fontWeight={600} letterSpacing="0.1em" fill={tone}>
        {label}
      </text>
    </motion.g>
  );
}

export function ArchitectureDiagram({
  className = "",
  staticMode = false,
}: {
  className?: string;
  staticMode?: boolean;
}) {
  return (
    <DiagramFrame
      className={className}
      viewBox="0 0 1200 612"
      amount={0.25}
      staticMode={staticMode}
      label="Alpha & Oversight architecture: an R&D desk (adversary plus two deterministic oracles) and a Surveillance desk (anomaly detector, investigator, specialist, a local prosecution-versus-defense debate, adjudicator, the gold rule engine, and escalation manager) sit on the Band coordination spine across a one-way Chinese wall enforced by the SanitizedBridge. The deterministic rule engine is the sole PASS/FLAG authority; a human peer confirms escalations; a hash-chained ledger seals every Band message."
    >
      {(show, reduce) => (
        <>
          {/* BAND spine */}
          <motion.g
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <rect x={330} y={18} width={540} height={46} rx={12} fill="var(--band-blue)" stroke="var(--band-blue)" />
            <rect x={330} y={18} width={540} height={46} rx={12} fill="none" stroke="var(--band-blue)" strokeWidth={6} opacity={0.18} />
            <text x={600} y={37} textAnchor="middle" className="font-mono" fontSize={13} fontWeight={700} letterSpacing="0.14em" fill="var(--frost)">
              BAND
            </text>
            <text x={600} y={53} textAnchor="middle" className="font-mono" fontSize={9.5} letterSpacing="0.05em" fill="var(--frost)" opacity={0.85}>
              HANDOFF · EVIDENCE · VERDICT · ESCALATION · RULE_CODIFIED
            </text>
          </motion.g>

          {/* desks */}
          <DeskFrame x={40} y={96} w={290} h={420} label="R&D DESK · RED TEAM" tone="var(--desk-rnd)" show={show} reduce={reduce} delay={0.1} />
          <DeskFrame x={430} y={96} w={730} h={420} label="SURVEILLANCE DESK · BLUE TEAM" tone="var(--desk-surv)" show={show} reduce={reduce} delay={0.1} />

          {/* Chinese wall */}
          <motion.line
            x1={356}
            y1={92}
            x2={356}
            y2={524}
            stroke="var(--text-faint)"
            strokeWidth={1.4}
            strokeDasharray="5 6"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={show ? { pathLength: 1, opacity: 0.8 } : undefined}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
          />
          <Tag x={356} y={86} text="⟂ Chinese wall" tone="neutral" anchor="middle" delay={0.9} show={show} reduce={reduce} />

          {/* R&D nodes */}
          <Node x={62} y={138} w={246} h={58} title="adversary" sub="frontier LLM · invents evasions" tone="rnd" titleMono delay={0.25} show={show} reduce={reduce} />
          <Node x={62} y={214} w={246} h={48} title="oracle 1 · rule engine" sub="does the rulebook MISS it?" tone="rnd" titleMono delay={0.32} show={show} reduce={reduce} />
          <Node x={62} y={276} w={246} h={48} title="oracle 2 · backtest" sub="profit AND price impact?" tone="rnd" titleMono delay={0.38} show={show} reduce={reduce} />
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.44, ease: EASE }}
          >
            <rect x={62} y={344} width={246} height={50} rx={10} fill="none" stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="5 4" />
            <text x={185} y={366} textAnchor="middle" className="font-sans" fontSize={11.5} fontStyle="italic" fill="var(--text-muted)">
              evades AND profits
            </text>
            <text x={185} y={382} textAnchor="middle" className="font-sans" fontSize={11.5} fontStyle="italic" fill="var(--text-muted)">
              = confirmed novel evasion
            </text>
          </motion.g>

          {/* SanitizedBridge straddling the wall */}
          <Node x={300} y={338} w={112} h={64} title="Sanitized" sub="Bridge · strips reasoning" tone="surv" titleMono delay={0.5} show={show} reduce={reduce} />

          {/* Surveillance relay */}
          <Node x={452} y={148} w={150} h={46} title="Anomaly Detector" tone="surv" titleMono delay={0.55} show={show} reduce={reduce} />
          <Node x={620} y={148} w={156} h={46} title="Investigator" tone="surv" titleMono delay={0.6} show={show} reduce={reduce} />
          <Node x={794} y={148} w={160} h={46} title="Specialist" tone="surv" titleMono delay={0.65} show={show} reduce={reduce} />

          {/* debate box */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5, delay: 0.7, ease: EASE }}
          >
            <rect x={452} y={228} width={300} height={86} rx={12} fill="none" stroke="var(--desk-surv)" strokeWidth={1} strokeDasharray="5 4" opacity={0.8} />
            <text x={602} y={306} textAnchor="middle" className="font-mono" fontSize={10} fontStyle="italic" fill="var(--text-muted)">
              local debate · off Band
            </text>
          </motion.g>
          <Node x={466} y={246} w={128} h={42} title="Prosecution" tone="surv" titleMono delay={0.74} show={show} reduce={reduce} />
          <Node x={610} y={246} w={128} h={42} title="Defense" tone="surv" titleMono delay={0.78} show={show} reduce={reduce} />

          <Node x={794} y={242} w={160} h={56} title="Adjudicator" sub="resolves the inputs" tone="surv" titleMono delay={0.82} show={show} reduce={reduce} />

          {/* rule engine - the authority */}
          <EngineNode x={556} y={356} w={252} h={64} delay={0.9} show={show} reduce={reduce} />

          {/* verdict chips */}
          <Chip x={470} y={448} w={150} label="FLAG → FLAGGED" tone="flag" delay={1.05} show={show} reduce={reduce} />
          <Chip x={648} y={448} w={216} label="PASS suspicious → ESCALATED" tone="escalate" delay={1.05} show={show} reduce={reduce} />

          {/* escalation + human */}
          <Node x={984} y={356} w={154} h={64} title="Escalation Manager" tone="surv" titleMono delay={0.95} show={show} reduce={reduce} />
          <Node x={984} y={242} w={154} h={56} title="Compliance officer" sub="(human peer)" tone="human" titleMono delay={0.95} show={show} reduce={reduce} />

          {/* ledger */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 0.6, delay: 1.1, ease: EASE }}
          >
            <rect x={40} y={544} width={1120} height={42} rx={10} fill="var(--bg-card)" stroke="var(--hairline)" strokeWidth={1} />
            <text x={60} y={570} className="font-mono" fontSize={11} fill="var(--text-muted)">
              hash-chained audit ledger
            </text>
            <text x={1140} y={570} textAnchor="end" className="font-mono" fontSize={11} fill="var(--band-blue)">
              hashₙ = sha256(prevₕₐₛₕ + body) · binds band_message_id · verify_chain()
            </text>
          </motion.g>

          {/* ── edges ───────────────────────────────────────────────── */}
          {/* band spine down to the surveillance desk + ledger */}
          <Edge from={{ x: 760, y: 64 }} to={{ x: 760, y: 96 }} mode="straight" tone="band" label="@mention handoffs" pulse delay={0.5} show={show} reduce={reduce} />
          <Edge from={{ x: 430, y: 64 }} to={{ x: 430, y: 544 }} mode="straight" tone="band" dashed width={1} delay={0.6} show={show} reduce={reduce} />

          {/* R&D internal */}
          <Edge from={{ x: 185, y: 196 }} to={{ x: 185, y: 214 }} mode="straight" delay={0.42} show={show} reduce={reduce} />
          <Edge from={{ x: 185, y: 262 }} to={{ x: 185, y: 276 }} mode="straight" delay={0.46} show={show} reduce={reduce} />
          <Edge from={{ x: 185, y: 324 }} to={{ x: 185, y: 344 }} mode="straight" delay={0.5} show={show} reduce={reduce} />
          <Edge from={{ x: 308, y: 369 }} to={{ x: 356, y: 370 }} mode="mid-h" delay={0.56} show={show} reduce={reduce} />

          {/* cross-wall HANDOFF (Band) bridge -> anomaly */}
          <Edge from={{ x: 408, y: 360 }} to={{ x: 452, y: 171 }} mode="vh" tone="band" label="HANDOFF · events only" pulse width={1.8} delay={0.7} show={show} reduce={reduce} />

          {/* relay */}
          <Edge from={{ x: 602, y: 171 }} to={{ x: 620, y: 171 }} mode="straight" delay={0.78} show={show} reduce={reduce} />
          <Edge from={{ x: 776, y: 171 }} to={{ x: 794, y: 171 }} mode="straight" delay={0.82} show={show} reduce={reduce} />
          {/* Specialist drops EVIDENCE into the local debate (lands on Defense) */}
          <Edge from={{ x: 836, y: 194 }} to={{ x: 674, y: 246 }} mode="mid-v" delay={0.86} show={show} reduce={reduce} />
          {/* debate -> Adjudicator (Defense right edge -> Adjudicator left edge) */}
          <Edge from={{ x: 738, y: 267 }} to={{ x: 794, y: 270 }} mode="straight" delay={0.9} show={show} reduce={reduce} />
          <Edge from={{ x: 874, y: 298 }} to={{ x: 682, y: 356 }} mode="mid-v" tone="neutral" delay={0.94} show={show} reduce={reduce} />
          <Tag x={778} y={312} text="resolved inputs" tone="neutral" anchor="middle" delay={1.0} show={show} reduce={reduce} />

          {/* engine outputs */}
          <Edge from={{ x: 600, y: 420 }} to={{ x: 545, y: 448 }} mode="mid-v" tone="flag" delay={1.05} show={show} reduce={reduce} />
          <Edge from={{ x: 720, y: 420 }} to={{ x: 756, y: 448 }} mode="mid-v" tone="escalate" delay={1.05} show={show} reduce={reduce} />
          <Edge from={{ x: 864, y: 461 }} to={{ x: 984, y: 392 }} mode="mid-h" tone="escalate" delay={1.1} show={show} reduce={reduce} />

          {/* escalation <-> human, codify back */}
          <Edge from={{ x: 1061, y: 356 }} to={{ x: 1061, y: 298 }} mode="straight" tone="escalate" label="ESCALATION" delay={1.15} show={show} reduce={reduce} />
          <Edge from={{ x: 984, y: 270 }} to={{ x: 808, y: 384 }} mode="mid-h" tone="neutral" dashed delay={1.2} show={show} reduce={reduce} />
          <Tag x={900} y={344} text="confirm → codify 4→5" tone="neutral" anchor="middle" delay={1.26} show={show} reduce={reduce} />

          {/* reverse rulebook (read-only) */}
          <Edge from={{ x: 556, y: 400 }} to={{ x: 308, y: 372 }} mode="mid-v" tone="neutral" dashed label="active rulebook → R&D (read-only)" delay={1.25} show={show} reduce={reduce} />
        </>
      )}
    </DiagramFrame>
  );
}

export default ArchitectureDiagram;
