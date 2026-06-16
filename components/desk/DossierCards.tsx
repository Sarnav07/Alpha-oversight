"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskUIStore } from "@/lib/desk/uiStore";
import type { Dossier } from "@/lib/types";
import ModelBadge from "./ModelBadge";

/**
 * DossierCards — the adversarial debate split: Prosecution ⚔ Defense, side by
 * side. The cross-model contrast is the point — Prosecution runs a frontier
 * model (gold accent), Defense a strong open model (graphite accent). Reads
 * `model.debate` (DebateView); shows an empty state until debate frames arrive.
 *
 * Both halves animate in with a small fade/slide; reduced-motion renders the
 * final state immediately.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Side = "prosecution" | "defense";

const SIDE_META: Record<
  Side,
  { title: string; icon: string; accent: string; accentDim: string; xFrom: number }
> = {
  prosecution: {
    title: "Prosecution",
    icon: "⚔",
    accent: "var(--tier-frontier)",
    accentDim: "#5a4d22",
    xFrom: -16,
  },
  defense: {
    title: "Defense",
    icon: "🛡",
    accent: "var(--tier-open)",
    accentDim: "var(--border-default)",
    xFrom: 16,
  },
};

function DossierCard({
  side,
  dossier,
  reduce,
}: {
  side: Side;
  dossier: Dossier | null;
  reduce: boolean;
}) {
  const meta = SIDE_META[side];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: meta.xFrom }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex-1 min-w-0 rounded-[var(--r-card)] border bg-[var(--bg-card)] p-4"
      style={{ borderColor: meta.accentDim }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: meta.accent }}
        >
          <span aria-hidden className="text-[13px] leading-none">
            {meta.icon}
          </span>
          {meta.title}
        </span>
        {dossier ? <ModelBadge modelId={dossier.model_id} /> : null}
      </div>

      {dossier ? (
        <>
          <p
            className="font-mono text-[10px] mb-2"
            style={{ color: "var(--text-faint)" }}
          >
            {dossier.agent_name}
          </p>
          <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
            {dossier.headline}
          </p>
          {dossier.detail ? (
            <p className="text-[12px] text-[var(--text-body)] mt-2 leading-relaxed">
              {dossier.detail}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[12px] text-[var(--text-muted)] py-6 text-center">
          awaiting {meta.title.toLowerCase()} dossier…
        </p>
      )}
    </motion.div>
  );
}

/** Free-text test over a dossier's surfaced fields (null-safe). */
function dossierMatchesQuery(d: Dossier | null, q: string): boolean {
  if (!q) return true;
  if (!d) return false;
  return [d.agent_name, d.headline, d.detail].some((f) =>
    (f ?? "").toLowerCase().includes(q),
  );
}

export default function DossierCards() {
  const reduce = useReducedMotion() ?? false;
  const debate = useDeskModel().debate;
  const nodeFilter = useDeskUIStore((s) => s.nodeFilter);
  const query = useDeskUIStore((s) => s.query);

  // Node filter: a side (prosecution/defense) is its own NodeId, so show only the
  // selected side when the filter targets one of them — hide the panel when the
  // filter targets some other node. Query: keep only sides whose dossier matches.
  const q = query.trim().toLowerCase();
  const nodeAllows = (side: Side) =>
    !nodeFilter || nodeFilter === side;
  const showProsecution =
    nodeAllows("prosecution") && dossierMatchesQuery(debate.prosecution, q);
  const showDefense =
    nodeAllows("defense") && dossierMatchesQuery(debate.defense, q);

  // The filter narrowed the desk to a non-debate node (or text with no debate
  // hit) — drop the whole panel rather than render two empty placeholders.
  if (!showProsecution && !showDefense) return null;

  return (
    <section aria-label="Prosecution vs Defense debate">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Cross-model debate
        </span>
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          frontier ⚔ open
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        {showProsecution ? (
          <DossierCard side="prosecution" dossier={debate.prosecution} reduce={reduce} />
        ) : null}
        {showDefense ? (
          <DossierCard side="defense" dossier={debate.defense} reduce={reduce} />
        ) : null}
      </div>
    </section>
  );
}
