/**
 * Static topology metadata — the canonical node set + ordered pipeline edges.
 * Shared by useDeskModel (status folding) and TopologyGraph (layout). Lead-owned
 * alongside contract.ts; teammate A reads it, teammate B reads it for layout.
 */
import type { NodeId } from "./contract";
import type { Desk, BandKind } from "../types";

export interface NodeMeta {
  id: NodeId;
  label: string;
  desk: Desk;
  /** which agent_name(s) in the stream map onto this node. */
  agents: string[];
  modelTier: "frontier" | "open" | "deterministic" | null;
}

export const NODE_META: NodeMeta[] = [
  // `agents` carries BOTH the lowercase Band/pipeline names AND the real CLASS-NAME
  // casing the agents emit (matched case-insensitively in nodeIdForAgent). Class names:
  // AnomalyDetector, Investigator, Specialist, Prosecution, Defense, Adjudicator,
  // EscalationManager (lowercased here, since nodeIdForAgent lowercases both sides).
  { id: "adversary", label: "Adversary", desk: "rnd", agents: ["adversary"], modelTier: "open" },
  { id: "bridge", label: "Sanitized Bridge", desk: "rnd", agents: ["bridge", "sanitizedbridge"], modelTier: null },
  // NOTE: `pipeline` (the narration agent carrying every marker) is intentionally NOT
  // mapped to a node — it would mislight the active node on verdict/terminal frames.
  { id: "anomaly_detector", label: "Anomaly Detector", desk: "surveillance", agents: ["anomaly_detector", "anomaly-detector", "anomalydetector"], modelTier: "open" },
  { id: "investigator", label: "Investigator", desk: "surveillance", agents: ["investigator"], modelTier: "open" },
  { id: "specialist", label: "Specialist", desk: "surveillance", agents: ["specialist", "@layer-spec"], modelTier: "open" },
  { id: "prosecution", label: "Prosecution", desk: "surveillance", agents: ["prosecution"], modelTier: "frontier" },
  { id: "defense", label: "Defense", desk: "surveillance", agents: ["defense"], modelTier: "open" },
  { id: "adjudicator", label: "Adjudicator", desk: "surveillance", agents: ["adjudicator"], modelTier: "open" },
  { id: "rule_engine", label: "Rule Engine", desk: "surveillance", agents: ["rule_engine", "rule-engine", "ruleengine"], modelTier: "deterministic" },
  { id: "escalation_manager", label: "Escalation Mgr", desk: "surveillance", agents: ["escalation_manager", "escalation-manager", "escalation", "escalationmanager"], modelTier: "frontier" },
  { id: "human", label: "Human", desk: "surveillance", agents: ["human"], modelTier: null },
];

/** Ordered pipeline edges (the happy path). `kind` = BandKind for cross-Band hops. */
export const EDGES: { from: NodeId; to: NodeId; kind: BandKind | null }[] = [
  { from: "adversary", to: "bridge", kind: "handoff" },
  { from: "bridge", to: "anomaly_detector", kind: "evidence" },
  { from: "anomaly_detector", to: "investigator", kind: null },
  { from: "investigator", to: "specialist", kind: "handoff" },
  { from: "specialist", to: "prosecution", kind: null },
  { from: "specialist", to: "defense", kind: null },
  { from: "prosecution", to: "adjudicator", kind: null },
  { from: "defense", to: "adjudicator", kind: null },
  { from: "adjudicator", to: "rule_engine", kind: "verdict" },
  { from: "rule_engine", to: "escalation_manager", kind: null },
  { from: "escalation_manager", to: "human", kind: "escalation" },
  { from: "human", to: "rule_engine", kind: "rule_codified" },
];

/** Map a raw agent_name to its NodeId (or null if unrecognized). */
export function nodeIdForAgent(agentName: string): NodeId | null {
  const a = agentName.toLowerCase();
  const meta = NODE_META.find((n) => n.agents.includes(a));
  return meta?.id ?? null;
}
