"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskController } from "@/lib/desk/controller";

/**
 * HITLControls — the human-in-the-loop verdict. Visible ONLY while the case is
 * ESCALATED (renders null otherwise). Confirm is the demo money-moment: it
 * codifies the 5th rule (ESCALATED → FLAGGED). Reject closes the case, codifies
 * nothing (ESCALATED → CLOSED).
 *
 * OPTIMISTIC: the click flips the local button state to pending → success
 * immediately while the controller mutates the model (case + rules). The model
 * re-renders ESCALATED → false, so this whole panel unmounts once the codify
 * tail lands — the success flash is the bridge.
 *
 * Live error map (for the eventual POST /cases/{id}/confirm|reject):
 *   422 → regression gate failed (rule NOT codified) — roll back, surface "gate failed"
 *   409 → case not ESCALATED (race) — refetch case, hide controls
 *   404 → unknown case id — surface "case not found", reset
 */

const SPRING = { type: "spring" as const, stiffness: 520, damping: 24 };
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Phase = "idle" | "confirming" | "rejecting" | "confirmed" | "rejected";

export default function HITLControls() {
  const reduce = useReducedMotion() ?? false;
  const state = useDeskModel().case.state;
  const controller = useDeskController();
  const [phase, setPhase] = useState<Phase>("idle");

  // Only the human decides on an ESCALATED case. Hidden in every other state.
  // Note: once confirm/reject resolves, the model leaves ESCALATED and this
  // unmounts — so we never linger in a stale success phase.
  if (state !== "ESCALATED") return null;

  const busy = phase === "confirming" || phase === "rejecting";

  const onConfirm = () => {
    if (busy) return;
    setPhase("confirming");
    // optimistic success flash before the model flips ESCALATED → FLAGGED.
    void controller.confirm();
    setTimeout(() => setPhase("confirmed"), reduce ? 0 : 220);
  };

  const onReject = () => {
    if (busy) return;
    setPhase("rejecting");
    void controller.reject();
    setTimeout(() => setPhase("rejected"), reduce ? 0 : 220);
  };

  return (
    <section
      aria-label="Human review"
      className="rounded-[var(--r-card)] border p-4"
      style={{
        borderColor: "var(--verdict-escalate)",
        background: "var(--bg-card)",
        boxShadow: reduce ? undefined : "0 0 18px #f59e0b22",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--verdict-escalate)" }}
        >
          Escalated · human review
        </span>
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          rules missed → you decide
        </span>
      </div>

      <p className="text-[12px] text-[var(--text-body)] mb-4 leading-relaxed">
        Deterministic engine passed; the debate flagged a novel evasion.
        Confirm to codify a new rule and re-flag, or reject to close.
      </p>

      <div className="flex gap-3">
        <motion.button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          whileTap={reduce ? undefined : { scale: 0.95 }}
          animate={
            phase === "confirmed" && !reduce
              ? { scale: [1, 1.06, 1] }
              : { scale: 1 }
          }
          transition={phase === "confirmed" ? SPRING : { duration: 0.18, ease: EASE }}
          className="flex-1 rounded-[var(--r-chip)] px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-default"
          style={
            phase === "confirmed"
              ? { background: "var(--verdict-complete)", color: "#04150d" }
              : {
                  background: "var(--verdict-escalate)",
                  color: "#1a1205",
                  opacity: phase === "rejecting" || phase === "rejected" ? 0.4 : 1,
                }
          }
        >
          {phase === "confirming"
            ? "codifying…"
            : phase === "confirmed"
              ? "✓ codified"
              : "Confirm — codify rule"}
        </motion.button>

        <motion.button
          type="button"
          onClick={onReject}
          disabled={busy}
          whileTap={reduce ? undefined : { scale: 0.95 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="flex-1 rounded-[var(--r-chip)] px-4 py-2.5 text-[13px] font-medium border transition-colors disabled:cursor-default"
          style={
            phase === "rejected"
              ? {
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                  background: "var(--bg-inset)",
                }
              : {
                  borderColor: "var(--border-default)",
                  color: "var(--text-body)",
                  background: "transparent",
                  opacity: phase === "confirming" || phase === "confirmed" ? 0.4 : 1,
                }
          }
        >
          {phase === "rejecting"
            ? "closing…"
            : phase === "rejected"
              ? "✓ closed"
              : "Reject — close case"}
        </motion.button>
      </div>
    </section>
  );
}
