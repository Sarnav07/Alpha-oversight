"use client";

/**
 * AuditChainSection — the landing page's `#audit` section (fixes the dead nav
 * anchor). A tamper-evident, append-only sha256 hash-chain rendered as a ladder
 * of ledger blocks (genesis → leaf → leaf → leaf → leaf) that animates on
 * scroll-into-view: the link edges between blocks DRAW (framer pathLength), the
 * blocks rise/fade in staggered, and a "verify_chain ✓" stamp wipes in last.
 *
 * The hashes are the hero — every id/hash/timestamp is `font-mono`, truncated,
 * crisp. Theme is the ROOT (dark) frame on purpose (NOT wrapped in
 * data-section=light) so the emerald ✓ and mono hashes glow against obsidian.
 *
 * Micro-interaction: hover/tap a single block to "tamper" with it — the verify
 * stamp flips red ✗ to dramatize that changing one byte breaks verification
 * (hash = sha256(prev_hash + canonical_json(entry)); verify_chain recomputes
 * every link).
 *
 * Semantic colour only: --verdict-pass/--verdict-complete for ✓, --verdict-flag
 * for the tamper ✗, --band-blue ONLY on the Band-handoff leaf (sacred = Band).
 *
 * Reduced-motion → the full chain + ✓ render immediately, no draw/stagger.
 * Self-contained, prop-less, default export. id="audit" on the root <section>.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { Reveal } from "@/components/anim/Reveal";
import { MaskLines } from "@/components/anim/MaskLines";

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ── the chain ───────────────────────────────────────────────────────────── */

type Kind = "handoff" | "evidence" | "verdict" | "escalation" | "rule_codified";

type Block = {
  i: number;
  kind: Kind;
  agent: string;
  role: string;
  band?: boolean; // a Band-handoff leaf → the only place --band-blue is allowed
  prev: string;
  hash: string;
  ts: string;
};

const KIND_LABEL: Record<Kind, string> = {
  handoff: "HANDOFF",
  evidence: "EVIDENCE",
  verdict: "VERDICT",
  escalation: "ESCALATION",
  rule_codified: "RULE_CODIFIED",
};

const CHAIN: Block[] = [
  { i: 0, kind: "handoff", agent: "bridge", role: "genesis · sanitized order flow", band: true, prev: "0x00…0000", hash: "0x8b1e…a3f9", ts: "T+0.00s" },
  { i: 1, kind: "evidence", agent: "investigator", role: "recruit @layer-spec", band: true, prev: "0x8b1e…a3f9", hash: "0x4d77…7c10", ts: "T+1.42s" },
  { i: 2, kind: "verdict", agent: "rule_engine", role: "PASS · no active rule tripped", prev: "0x4d77…7c10", hash: "0xc0aa…e904", ts: "T+2.18s" },
  { i: 3, kind: "escalation", agent: "escalation", role: "→ human · novel 400ms evasion", band: true, prev: "0xc0aa…e904", hash: "0x9f31…b27d", ts: "T+2.61s" },
  { i: 4, kind: "rule_codified", agent: "codify", role: "FINRA-5210-layering-v2 · gate PASS", prev: "0x9f31…b27d", hash: "0x1ed2…0f5c", ts: "T+2.94s" },
];

/* ── tiny atoms ──────────────────────────────────────────────────────────── */

function KindBadge({ kind }: { kind: Kind }) {
  return (
    <span
      className="inline-flex items-center rounded-[var(--r-chip)] border px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em]"
      style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M9 12h6" />
      <path d="M10 8.5h-1a3.5 3.5 0 0 0 0 7h1" />
      <path d="M14 8.5h1a3.5 3.5 0 0 1 0 7h-1" />
    </svg>
  );
}

/* ── the connecting "sha256" edge that draws between two blocks ──────────── */

function ChainEdge({ index, tampered }: { index: number; tampered: boolean }) {
  const reduce = useReducedMotion();
  const broken = tampered; // a broken link recolors flag-red

  const stroke = broken ? "var(--verdict-flag)" : "var(--verdict-pass)";

  return (
    <div className="relative flex shrink-0 items-center" aria-hidden="true">
      <svg viewBox="0 0 64 20" className="h-5 w-10 lg:w-16" fill="none" preserveAspectRatio="none">
        <motion.path
          d="M2 10 H62"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={broken ? "4 4" : undefined}
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          whileInView={reduce ? undefined : { pathLength: 1, opacity: broken ? 0.9 : 0.8 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.18 + index * 0.16 }}
        />
      </svg>
      <span
        className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border"
        style={{
          backgroundColor: "var(--bg-page)",
          borderColor: broken ? "var(--verdict-flag)" : "var(--border-subtle)",
          color: broken ? "var(--verdict-flag)" : "var(--text-faint)",
        }}
      >
        <LinkIcon />
      </span>
    </div>
  );
}

/* ── one ledger block ────────────────────────────────────────────────────── */

function LedgerBlock({
  b,
  index,
  tampered,
  onTamper,
}: {
  b: Block;
  index: number;
  tampered: boolean;
  onTamper: (next: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const hashColor = tampered ? "var(--verdict-flag)" : "var(--verdict-pass)";

  return (
    <motion.button
      type="button"
      onClick={() => onTamper(!tampered)}
      onMouseEnter={() => onTamper(true)}
      onMouseLeave={() => onTamper(false)}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.16 }}
      className="group relative flex w-[15.5rem] shrink-0 cursor-pointer flex-col gap-3 rounded-[var(--r-card)] border p-4 text-left transition-colors focus:outline-none"
      style={{
        backgroundColor: tampered ? "color-mix(in srgb, var(--verdict-flag) 7%, var(--bg-card))" : "var(--bg-card)",
        borderColor: tampered ? "var(--verdict-flag)" : "var(--border-subtle)",
      }}
      aria-label={`Ledger block ${b.i}: ${KIND_LABEL[b.kind]} by ${b.agent}. Toggle tamper to test verification.`}
    >
      {/* header: index + kind badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-[var(--text-faint)]">#{String(b.i).padStart(2, "0")}</span>
        <KindBadge kind={b.kind} />
      </div>

      {/* agent / role line */}
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-[var(--text-primary)]">
          {b.agent}
          {b.band && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--band-blue)", boxShadow: "0 0 6px var(--band-blue-glow)" }}
              title="Band handoff leaf"
              aria-hidden="true"
            />
          )}
        </span>
        <span className="font-sans text-[10.5px] leading-snug text-[var(--text-muted)]">{b.role}</span>
      </div>

      {/* hashes — the hero */}
      <div className="flex flex-col gap-1 border-t border-[var(--hairline)] pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">prev</span>
          <span className="truncate font-mono text-[10px] text-[var(--text-body)]">{b.prev}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">hash</span>
          <span className="truncate font-mono text-[10px] font-medium transition-colors" style={{ color: hashColor }}>
            {b.hash}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">ts</span>
          <span className="font-mono text-[9px] text-[var(--text-faint)]">{b.ts}</span>
        </div>
      </div>

      {/* tamper hint */}
      <span
        className="pointer-events-none absolute inset-x-0 -bottom-5 text-center font-mono text-[8.5px] uppercase tracking-[0.14em] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: "var(--verdict-flag)" }}
      >
        byte mutated
      </span>
    </motion.button>
  );
}

/* ── verify_chain stamp (wipes in last; flips red ✗ on tamper) ───────────── */

function VerifyStamp({ tampered }: { tampered: boolean }) {
  const reduce = useReducedMotion();
  const ok = !tampered;
  const accent = ok ? "var(--verdict-complete)" : "var(--verdict-flag)";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.92, clipPath: "inset(0 100% 0 0)" }}
      whileInView={reduce ? undefined : { opacity: 1, scale: 1, clipPath: "inset(0 0% 0 0)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.18 + CHAIN.length * 0.16 }}
      className="inline-flex items-center gap-2 rounded-[var(--r-pill)] border px-4 py-2"
      style={{
        backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
      />
      <span className="font-mono text-[12px] tracking-[0.04em]" style={{ color: accent }}>
        {ok ? "verify_chain ✓" : "verify_chain ✗  link broken"}
      </span>
    </motion.div>
  );
}

/* ── section ─────────────────────────────────────────────────────────────── */

export default function AuditChainSection() {
  // which block (if any) is currently being "tampered" with; a tamper breaks
  // every downstream link (and therefore the whole chain's verification).
  const [tamperedIdx, setTamperedIdx] = useState<number | null>(null);
  const chainBroken = tamperedIdx !== null;

  return (
    <section
      id="audit"
      data-section="dark"
      className="relative w-full overflow-hidden bg-[var(--bg-page)] px-6 py-28 text-[var(--text-primary)] sm:px-10 lg:py-36"
    >
      <div className="mx-auto max-w-[var(--maxw-content)]">
        {/* eyebrow + logomark-style anchor */}
        <Reveal className="mb-6 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Audit</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">sha256 · append-only</span>
        </Reveal>

        {/* two-tone heading */}
        <MaskLines
          className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-6xl"
          lines={[
            <span key="l1" className="text-[var(--text-primary)]">Every step,</span>,
            <span key="l2" className="text-[var(--text-muted)]">hash-chained.</span>,
          ]}
        />

        {/* intro paragraph */}
        <Reveal delay={0.1} className="mt-6 max-w-xl">
          <p className="font-sans text-[15px] leading-relaxed text-[var(--text-body)]">
            The ledger is the compliance system of record. Every Band handoff and agent step is
            sha256-chained — <span className="font-mono text-[13px] text-[var(--text-primary)]">hash = sha256(prev_hash + canonical_json(entry))</span>.
            Change one byte and verification fails. Hover a block to mutate it and watch the chain break.
          </p>
        </Reveal>

        {/* the ladder of blocks + drawn link edges */}
        <div className="mt-14 overflow-x-auto pb-4">
          <div className="flex min-w-max items-stretch">
            {CHAIN.map((b, idx) => (
              <div key={b.i} className="flex items-center">
                <LedgerBlock
                  b={b}
                  index={idx}
                  tampered={tamperedIdx === b.i}
                  onTamper={(next) => setTamperedIdx(next ? b.i : null)}
                />
                {idx < CHAIN.length - 1 && (
                  <ChainEdge
                    index={idx}
                    // a link is "broken" if the tamper is at or before this edge's
                    // left block — every downstream recompute now mismatches.
                    tampered={tamperedIdx !== null && tamperedIdx <= b.i}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* verify stamp */}
        <div className="mt-12 flex items-center gap-4">
          <VerifyStamp tampered={chainBroken} />
          <span className="font-mono text-[11px] text-[var(--text-faint)]">
            {chainBroken ? "recompute mismatched a downstream link" : `${CHAIN.length} leaves · genesis prev_hash = ""`}
          </span>
        </div>
      </div>
    </section>
  );
}
