/**
 * useDeskModel — folds the raw ActivityEvent stream (useTraceStore) into the
 * view-models in contract.ts. THIS IS A WORKING STUB (teammate A owns + enriches):
 * it already derives node status, case state, verdict, debate and timeline from
 * markers so components render immediately. A's job: harden the folding, wire the
 * codify 4→5 reveal, and add the rule/stats derivation from the controller's mock
 * registry. Components must depend ONLY on the DeskModel shape, never on internals.
 */
"use client";

import { useMemo } from "react";
import { useTraceStore } from "../store/useTraceStore";
import { parseMarker } from "../eventsource/parseMarker";
import { NODE_META, EDGES, nodeIdForAgent } from "./nodes";
import { useRulesStore, SEED_RULES } from "./controller";
import { useStats, useRules } from "../api/queries";
import { IS_MOCK } from "../config";
import type {
  DeskModel,
  NodeView,
  NodeStatus,
  EdgeView,
  NodeId,
  TimelineDot,
  CaseView,
  DebateView,
} from "./contract";
import type { ActivityEvent, Verdict, Stats, Rule } from "../types";

const EMPTY_STATS: Stats = {
  total_cases: 0,
  by_state: {},
  flagged: 0,
  escalated: 0,
  active_rules: 4,
};

/**
 * Resolve the latest event for a node by raw agent_name lookup AND by NodeId,
 * so it lands whether the frame used a Band-handoff lowercase sender
 * (`investigator`) or a real class name (`Investigator`). latestByAgent is keyed
 * by the verbatim agent_name; this folds both casings onto the canonical node.
 */
function latestForNode(
  latestByAgent: Record<string, ActivityEvent>,
  nodeId: NodeId,
): ActivityEvent | undefined {
  let best: ActivityEvent | undefined;
  for (const [name, ev] of Object.entries(latestByAgent)) {
    if (nodeIdForAgent(name) !== nodeId) continue;
    if (!best || ev.created_at >= best.created_at) best = ev;
  }
  return best;
}

/** lowercase RuleFamily set — used to sniff the family out of free-text content. */
const FAMILIES = ["spoofing", "layering", "wash_trade", "marking"] as const;
function sniffFamily(content: string | null): string | null {
  if (!content) return null;
  const c = content.toLowerCase();
  return FAMILIES.find((f) => c.includes(f)) ?? null;
}

function deriveCase(events: ActivityEvent[]): CaseView {
  const view: CaseView = { id: null, state: null, verdict: null, family: null };
  for (const e of events) {
    if (e.case_id) view.id = e.case_id;
    const m = parseMarker(e);
    // family: prefer the verdict rule family, else sniff specialist/adversary text.
    const fam = sniffFamily(e.content);
    if (fam) view.family = fam;

    if (m.stage === "anomaly" && !view.state) view.state = "UNDER_REVIEW";
    if (m.stage === "recruit") view.state = "UNDER_REVIEW";
    if (m.result) {
      view.verdict = {
        result: m.result === "FLAG" ? "FLAG" : "PASS",
        rule_id: m.result === "FLAG" ? m.ruleId ?? null : null,
        cited_metric: null,
      } as Verdict;
    }
    if (m.stage === "verdict" && m.result === "FLAG") view.state = "FLAGGED";
    if (m.stage === "escalate") view.state = "ESCALATED";
    if (m.stage === "codify") view.state = "FLAGGED";
  }
  return view;
}

function deriveNodes(
  events: ActivityEvent[],
  latestByAgent: Record<string, ActivityEvent>,
): { nodes: NodeView[]; activeNode: NodeId | null; bandWaiting: boolean } {
  const last = events[events.length - 1];
  const activeNode = last ? nodeIdForAgent(last.agent_name) : null;
  const seen = new Set(events.map((e) => nodeIdForAgent(e.agent_name)).filter(Boolean));
  // Investigator goes blue ("waiting on Band") from when it emits its recruit
  // handoff until the next desk node — the specialist — responds. parseMarker
  // overwrites stage to "recruit" when both tokens are present, so we read the
  // raw "waiting on band" text instead, then gate on the specialist not yet seen.
  const invEvent = latestForNode(latestByAgent, "investigator");
  const invWaiting = /waiting on band/i.test(invEvent?.content ?? "");
  const bandWaiting = invWaiting && !seen.has("specialist");

  const nodes: NodeView[] = NODE_META.map((meta) => {
    let status: NodeStatus = "idle";
    if (seen.has(meta.id)) status = "done";
    if (meta.id === activeNode) status = "active";
    if (meta.id === "investigator" && bandWaiting) status = "waiting_on_band";
    const ev = latestForNode(latestByAgent, meta.id);
    return {
      id: meta.id,
      label: meta.label,
      desk: meta.desk,
      status,
      detail: ev?.content ?? null,
      modelTier: meta.modelTier,
    };
  });
  return { nodes, activeNode, bandWaiting };
}

function deriveEdges(events: ActivityEvent[]): EdgeView[] {
  const seen = new Set(events.map((e) => nodeIdForAgent(e.agent_name)).filter(Boolean));
  const lastId = events.length ? nodeIdForAgent(events[events.length - 1].agent_name) : null;
  return EDGES.map((edge) => ({
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    active: edge.to === lastId || (seen.has(edge.from) && seen.has(edge.to)),
  }));
}

function deriveDebate(latestByAgent: Record<string, ActivityEvent>): DebateView {
  const toDossier = (e?: ActivityEvent) =>
    e
      ? {
          agent_name: e.agent_name,
          model_id: e.model_id,
          headline: e.content ?? "",
          detail: e.reasoning ?? "",
          claimed_inputs: {},
        }
      : null;
  return {
    prosecution: toDossier(latestForNode(latestByAgent, "prosecution")),
    defense: toDossier(latestForNode(latestByAgent, "defense")),
  };
}

function deriveTimeline(events: ActivityEvent[]): TimelineDot[] {
  const dots: TimelineDot[] = [];
  events.forEach((e, i) => {
    const m = parseMarker(e);
    // raw "waiting on band" text — parseMarker overwrites stage to "recruit"
    // when the same frame also carries the recruit handoff tokens.
    const waiting = /waiting on band/i.test(e.content ?? "");
    let tone: TimelineDot["tone"] | null = null;
    if (waiting) tone = "band";
    else if (m.result === "PASS") tone = "pass";
    else if (m.result === "FLAG") tone = "flag";
    else if (m.stage === "escalate") tone = "escalate";
    else if (m.stage === "codify") tone = "complete";
    if (tone) {
      dots.push({ id: `${e.agent_name}-${i}`, label: e.agent_name, tone, ts: e.created_at });
    }
  });
  return dots;
}

export function useDeskModel(): DeskModel {
  const events = useTraceStore((s) => s.events);
  const latestByAgent = useTraceStore((s) => s.latestByAgent);

  // Mock rule registry — the source of truth ONLY in mock mode (the controller's
  // codify(4→5) mutates it). Subscribed unconditionally so hook order is stable.
  const mockRules = useRulesStore((s) => s.rules);
  const mockCodified = useRulesStore((s) => s.codified);

  // Live REST sources — always called (Rules of Hooks), consumed only when live.
  // RestLive returns the bundled MOCK_RULES/MOCK_STATS in mock mode, so these are
  // harmless to subscribe to; we still branch on IS_MOCK for the seam to be explicit.
  const liveRulesQ = useRules();
  const liveStatsQ = useStats();

  // The SSE-event fold drives nodes/edges/timeline/debate/case/bandWaiting in BOTH
  // modes. Only `rules` + `stats` (and the codified flag) differ by data source.
  const rules: Rule[] = IS_MOCK ? mockRules : liveRulesQ.data ?? SEED_RULES;
  const liveStats = liveStatsQ.data;

  return useMemo<DeskModel>(() => {
    const caseView = deriveCase(events);
    const { nodes, activeNode, bandWaiting } = deriveNodes(events, latestByAgent);

    // codified: mock reads the registry flag; live infers from a 5th (human-
    // provenance / non-seed) rule landing after the REST refetch.
    const codified = IS_MOCK
      ? mockCodified
      : rules.some((r) => r.provenance?.startsWith?.("human")) || rules.length > 4;

    // stats: mock derives a single-case view from the fold; live uses GET /stats
    // counts verbatim (active_rules tracks the codified reveal via the rules list).
    let stats: Stats;
    if (IS_MOCK || !liveStats) {
      const byState: Record<string, number> = {};
      if (caseView.state) byState[caseView.state] = 1;
      stats = {
        ...EMPTY_STATS,
        total_cases: caseView.id ? 1 : 0,
        by_state: byState,
        flagged: caseView.state === "FLAGGED" ? 1 : 0,
        escalated: caseView.state === "ESCALATED" ? 1 : 0,
        active_rules: rules.length,
      };
    } else {
      stats = { ...liveStats, active_rules: rules.length };
    }

    return {
      case: caseView,
      nodes,
      edges: deriveEdges(events),
      rules,
      stats,
      debate: deriveDebate(latestByAgent),
      timeline: deriveTimeline(events),
      activeNode,
      bandWaiting,
      codified,
    };
  }, [events, latestByAgent, rules, mockCodified, liveStats]);
}
