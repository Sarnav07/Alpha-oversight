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
import { useClockStore } from "./clock";
import { fixtureAuditC0187 } from "../fixtures/audit-C-0187";
import { api } from "../api/client";
import { IS_MOCK } from "../config";
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

/**
 * LIVE seam: fire a demo POST, then open the real SSE so /stream drives the
 * fold. The store's connect() builds a LiveSSEAdapter in live mode (no replay
 * param → the live `/stream`); the backend runs one case at a time, so the
 * returned case_id rides in on every frame's `case_id` (Q6). REST failures are
 * logged but non-fatal — the stream is the source of truth.
 */
async function startLive(trigger: () => Promise<{ case_id?: string }>) {
  clearTimers();
  useTraceStore.getState().reset();
  useRulesStore.getState().resetRules();
  // open the SSE first so we don't miss the opening frames the POST kicks off.
  useTraceStore.getState().connect();
  try {
    await trigger();
  } catch (err) {
    console.error("[desk] live demo trigger failed:", err);
  }
}

const liveController: DeskController = {
  runBeatA: () => {
    void startLive(() => api.beatA());
  },
  runBeatB: () => {
    void startLive(() => api.beatB());
  },
  runRnD: () => {
    void startLive(async () => {
      const r = await api.rnd();
      // rnd union: confirmed → carries a case_id+stream; failed → no case.
      return { case_id: r.case_id };
    });
  },
  confirm: async () => {
    const caseId = currentCaseId();
    if (!caseId) return;
    try {
      const res = await api.confirm(caseId);
      // Optimistic local-view nudge: push a synthetic codify frame so the
      // timeline/topology react instantly; useInvalidateOnMarkers (watching this
      // very frame) refetches /rules + /stats for the authoritative 4→5 reveal.
      const ruleId = res.rule?.id ?? `layering-v2-${caseId}`;
      play(
        [
          {
            agent_name: "human",
            model_id: "",
            desk: "surveillance",
            content: `confirm ${caseId} — codify the candidate layering rule`,
            reasoning: null,
            tool_calls: [{ kind: "band_rule_codified", to: "rule_engine" }],
            created_at: new Date().toISOString(),
            case_id: caseId,
          },
          {
            agent_name: "rule_engine",
            model_id: "deterministic",
            desk: "surveillance",
            content: `codify: regression gate PASS — rule ${ruleId} ACTIVE`,
            reasoning: "replayed the original evasion through the new rule; it now FLAGs",
            tool_calls: [],
            created_at: new Date(Date.now() + 1).toISOString(),
            case_id: caseId,
          },
        ],
        400,
      );
    } catch (err) {
      console.error("[desk] confirm failed:", err);
    }
  },
  reject: async () => {
    const caseId = currentCaseId();
    if (!caseId) return;
    try {
      const res = await api.reject(caseId);
      // res.case is the now-CLOSED case (codified:false). Optimistic close frame;
      // useInvalidateOnMarkers refetches the stats so the tiles settle.
      const finalState = res.case?.state ?? "CLOSED";
      play(
        [
          {
            agent_name: "human",
            model_id: "",
            desk: "surveillance",
            content: `reject — case ${caseId} -> ${finalState}, no codify`,
            reasoning: null,
            tool_calls: [],
            created_at: new Date().toISOString(),
            case_id: caseId,
          },
        ],
        400,
      );
    } catch (err) {
      console.error("[desk] reject failed:", err);
    }
  },
  resetDesk: () => {
    clearTimers();
    useTraceStore.getState().disconnect();
    useTraceStore.getState().reset();
    useRulesStore.getState().resetRules();
  },
};

/**
 * The mock human-Confirm: append the codify tail onto the loaded clock sequence
 * and codify the candidate layering rule (the 4→5 reveal). Exported so the 90s
 * auto-pilot (lib/desk/autopilot.ts) can fire the same confirm without a hook.
 */
export function mockConfirm() {
  const caseId = currentCaseId() ?? "C-0187";
  useClockStore.getState().append(codifyTail(caseId));
  useRulesStore.getState().codify({
    id: `layering-v2-${caseId}`,
    family: "layering",
    params: { window_ms: 450, min_depth_levels: 3 },
    provenance: `human:analyst/${caseId}`,
    status: "ACTIVE",
  });
}

/**
 * Mock paths drive the ReplayClock (lib/desk/clock.ts) instead of the old inline
 * `play()` timers — the clock is the single scrubbable player, so Beat A/B/R&D are
 * load+play and the human Confirm/Reject tails are appended onto the loaded
 * sequence (so a later scrub replays them too). The clock owns the trace reset +
 * connection state; we only reset the rule registry alongside.
 */
const mockController: DeskController = {
  runBeatA: () => {
    useRulesStore.getState().resetRules();
    useClockStore.getState().load("C-0191");
    useClockStore.getState().play();
  },
  runBeatB: () => {
    useRulesStore.getState().resetRules();
    useClockStore.getState().load("C-0187");
    useClockStore.getState().play();
  },
  runRnD: () => {
    // Real R&D adversarial loop now (fixtureRnD / C-0188) — no longer a stub (Q2).
    useRulesStore.getState().resetRules();
    useClockStore.getState().load("C-0188");
    useClockStore.getState().play();
  },
  confirm: async () => mockConfirm(),
  reject: async () => {
    const caseId = currentCaseId() ?? "C-0187";
    useClockStore.getState().append([
      {
        agent_name: "human",
        model_id: "",
        desk: "surveillance",
        content: "reject — case CLOSED, no codify",
        reasoning: null,
        tool_calls: [],
        created_at: "2026-06-15T10:23:50Z",
        case_id: caseId,
      },
    ]);
  },
  resetDesk: () => {
    useClockStore.getState().reset();
    useRulesStore.getState().resetRules();
  },
};

export function useDeskController(): DeskController {
  return IS_MOCK ? mockController : liveController;
}

/** non-hook read of the current case id from the event stream (NOT a React hook,
 *  despite being called from controller actions — reads the store imperatively). */
function currentCaseId(): string | null {
  const events = useTraceStore.getState().events;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].case_id) return events[i].case_id!;
  }
  return null;
}
