"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
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

export default function DossierCards() {
  const reduce = useReducedMotion() ?? false;
  const debate = useDeskModel().debate;

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
        <DossierCard side="prosecution" dossier={debate.prosecution} reduce={reduce} />
        <DossierCard side="defense" dossier={debate.defense} reduce={reduce} />
      </div>
    </section>
  );
}
