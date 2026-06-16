/**
 * Desk controller + mock rule registry. WORKING STUB (teammate A owns + enriches):
 * drives the demo by playing fixture event sequences into useTraceStore and
 * mutating the mock rule registry on confirm (the 4→5 codify reveal). When the
 * live backend lands, A swaps the players for POST /demo/* + POST /confirm and the
 * DeskController surface stays identical, so components never change.
 *
 * A's TODO: replace the single C-0187 fixture with distinct Beat-A (instant flag)
 * and Beat-B (escalate→confirm→codify) fixtures + an audit hash-chain fixture, and
 * route runBeatA/runBeatB through the MockAdapter rather than the inline player.
 */
"use client";

import { create } from "zustand";
import { useTraceStore } from "../store/useTraceStore";
import { fixtureBeatA } from "../fixtures/beat-a";
import { fixtureBeatB } from "../fixtures/beat-b";
import { fixtureAuditC0187 } from "../fixtures/audit-C-0187";
import type { AuditView, DeskController } from "./contract";
import type { ActivityEvent, Rule } from "../types";

/** Seed registry — the 4 ACTIVE rules at boot (rule_contracts seed_rules). */
export const SEED_RULES: Rule[] = [
  { id: "FINRA-5210-layering", family: "layering", params: { window_ms: 100, min_depth_levels: 3 }, provenance: "seed", status: "ACTIVE" },
  { id: "FINRA-5210-spoofing", family: "spoofing", params: { window_ms: 100, min_cancel_ratio: 0.8 }, provenance: "seed", status: "ACTIVE" },
  { id: "SEC-10b-5-wash", family: "wash_trade", params: { min_self_match_ratio: 0.5 }, provenance: "seed", status: "ACTIVE" },
  { id: "SEC-10b-5-marking", family: "marking", params: { min_print_move_bps: 100.0 }, provenance: "seed", status: "ACTIVE" },
];

interface RulesState {
  rules: Rule[];
  /** true once the codified 5th rule is present (drives the reveal animation). */
  codified: boolean;
  codify: (rule: Rule) => void;
  resetRules: () => void;
}

export const useRulesStore = create<RulesState>((set) => ({
  rules: SEED_RULES,
  codified: false,
  codify: (rule) =>
    set((s) => (s.rules.some((r) => r.id === rule.id) ? s : { rules: [...s.rules, rule], codified: true })),
  resetRules: () => set({ rules: SEED_RULES, codified: false }),
}));

/** A scheduled fixture player (mock cadence). Returns a cancel fn. */
let timers: ReturnType<typeof setTimeout>[] = [];
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}
function play(events: ActivityEvent[], stepMs = 900, startDelay = 0) {
  const push = useTraceStore.getState().pushEvent;
  events.forEach((e, i) => {
    timers.push(setTimeout(() => push(e), startDelay + i * stepMs));
  });
}

/** The codify tail appended on confirm — narrates the regression-gate ✓ + 4→5. */
function codifyTail(caseId: string): ActivityEvent[] {
  return [
    { agent_name: "human", model_id: "", desk: "surveillance", content: `confirm ${caseId} — codify the candidate layering rule`, reasoning: null, tool_calls: [{ kind: "band_rule_codified", to: "rule_engine" }], created_at: "2026-06-15T10:23:50Z", case_id: caseId },
    { agent_name: "rule_engine", model_id: "deterministic", desk: "surveillance", content: `codify: regression gate PASS — rule layering-v2-${caseId} ACTIVE (Active Rules 4 -> 5)`, reasoning: "replayed the original evasion through the new rule; it now FLAGs", tool_calls: [], created_at: "2026-06-15T10:23:51Z", case_id: caseId },
  ];
}

/** Audit-drawer view (hash-chain verifier). Mock now; GET /cases/{id}/audit later. */
export function getAuditView(caseId?: string | null): AuditView {
  // single canned chain for now; keyed by case id when more fixtures land.
  if (caseId && caseId !== fixtureAuditC0187.case_id) {
    return { caseId, entries: [], verified: true };
  }
  return {
    caseId: fixtureAuditC0187.case_id,
    entries: fixtureAuditC0187.entries,
    verified: fixtureAuditC0187.verified,
  };
}

export function useDeskController(): DeskController {
  return {
    runBeatA: () => {
      clearTimers();
      useTraceStore.getState().reset();
      useRulesStore.getState().resetRules();
      play(fixtureBeatA, 700);
    },
    runBeatB: () => {
      clearTimers();
      useTraceStore.getState().reset();
      useRulesStore.getState().resetRules();
      play(fixtureBeatB, 900);
    },
    runRnD: () => {
      // POST /demo/rnd not built — Beat-B stands in for the R&D lane (Q2).
      console.info("[desk] R&D lane stubbed — run Beat B for the evasion→escalation demo.");
    },
    confirm: async () => {
      const caseId = useDeskCaseId() ?? "C-0187";
      play(codifyTail(caseId), 600);
      useRulesStore.getState().codify({
        id: `layering-v2-${caseId}`,
        family: "layering",
        params: { window_ms: 450, min_depth_levels: 3 },
        provenance: `human:analyst/${caseId}`,
        status: "ACTIVE",
      });
    },
    reject: async () => {
      const caseId = useDeskCaseId() ?? "C-0187";
      play(
        [{ agent_name: "human", model_id: "", desk: "surveillance", content: "reject — case CLOSED, no codify", reasoning: null, tool_calls: [], created_at: "2026-06-15T10:23:50Z", case_id: caseId }],
        600,
      );
    },
    resetDesk: () => {
      clearTimers();
      useTraceStore.getState().reset();
      useRulesStore.getState().resetRules();
    },
  };
}

/** non-hook read of the current case id from the event stream. */
function useDeskCaseId(): string | null {
  const events = useTraceStore.getState().events;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].case_id) return events[i].case_id!;
  }
  return null;
}
