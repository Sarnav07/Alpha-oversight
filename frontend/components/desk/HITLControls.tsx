"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskController, DeskActionError } from "@/lib/desk/controller";

/**
 * HITLControls - the human-in-the-loop verdict. Visible ONLY while the case is
 * ESCALATED (renders null otherwise). Confirm is the demo money-moment: it
 * codifies the 5th rule (ESCALATED → FLAGGED). Reject closes the case, codifies
 * nothing (ESCALATED → CLOSED).
 *
 * OPTIMISTIC-ON-SUCCESS: the click flips to a pending state while the controller
 * awaits the POST. On success we flash success and the model re-renders
 * ESCALATED → false, unmounting this panel once the codify tail lands. On
 * failure we hold the panel and surface an inline reason mapped from the HTTP
 * status (see reasonForStatus) - the button no longer claims success on a reject.
 */

const SPRING = { type: "spring" as const, stiffness: 520, damping: 24 };
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type Phase =
  | "idle"
  | "confirming"
  | "rejecting"
  | "confirmed"
  | "rejected"
  | "error";

/** Map a failed POST /cases/{id}/confirm|reject status to an inline reason. */
function reasonForStatus(status: number | null): string {
  switch (status) {
    case 422:
      return "regression gate failed - rule not codified";
    case 409:
      return "case no longer awaiting review";
    case 404:
      return "case not found";
    default:
      return "action failed - try again";
  }
}

export default function HITLControls() {
  const reduce = useReducedMotion() ?? false;
  const state = useDeskModel().case.state;
  const controller = useDeskController();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  // Only the human decides on an ESCALATED case. In every other state we still
  // render the box frame (idle) so the right column always shows two boxes.
  // Once confirm/reject resolves, the model leaves ESCALATED and this falls back
  // to the idle frame - we never linger in a stale success phase.
  if (state !== "ESCALATED") {
    return (
      <section
        aria-label="Human review"
        className="rounded-[var(--r-card)] border p-4"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Human review
          </span>
          <span className="font-mono text-[10px] text-[var(--text-faint)]">
            in the loop
          </span>
        </div>
        <p className="text-[12px] text-[var(--text-faint)] leading-relaxed">
          No case awaiting review. When the engine passes but the debate flags a
          novel evasion, the case escalates here for your Confirm - codifying a new
          rule and re-flagging - or Reject to close.
        </p>
      </section>
    );
  }

  const busy = phase === "confirming" || phase === "rejecting";

  const onError = (err: unknown) => {
    const status = err instanceof DeskActionError ? err.status : null;
    setError(reasonForStatus(status));
    setPhase("error");
  };

  const onConfirm = async () => {
    if (busy) return;
    setError(null);
    setPhase("confirming");
    try {
      await controller.confirm();
      // Only on success - the model flips ESCALATED → FLAGGED and unmounts us.
      setPhase("confirmed");
    } catch (err) {
      onError(err);
    }
  };

  const onReject = async () => {
    if (busy) return;
    setError(null);
    setPhase("rejecting");
    try {
      await controller.reject();
      setPhase("rejected");
    } catch (err) {
      onError(err);
    }
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
          aria-busy={busy}
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
              : "Confirm - codify rule"}
        </motion.button>

        <motion.button
          type="button"
          onClick={onReject}
          disabled={busy}
          aria-busy={busy}
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
              : "Reject - close case"}
        </motion.button>
      </div>

      {phase === "error" && error && (
        <motion.p
          role="alert"
          initial={reduce ? false : { opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="mt-3 font-mono text-[11px]"
          style={{ color: "var(--verdict-flag)" }}
        >
          {error}
        </motion.p>
      )}
    </section>
  );
}
