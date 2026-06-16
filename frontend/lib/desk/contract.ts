/**
 * FROZEN CONTRACT — the single seam between the desk data layer and every
 * `/desk` component. Lead-owned: teammates IMPORT from here but must NOT edit it.
 *
 * Data flow:  fixtures → MockAdapter → useTraceStore(events) → useDeskModel()
 *             folds raw events into the view-models below. Components read the
 *             view-models and call DeskController actions. Nothing touches raw
 *             ActivityEvents except useDeskModel itself.
 *
 * Mock-now, swap-proof: when the live backend lands, only model.ts/controller.ts
 * change — this contract and all components stay identical.
 */
import type {
  CaseState,
  Verdict,
  Rule,
  Dossier,
  Stats,
  Desk,
  LedgerEntry,
} from "../types";

/** Canonical topology node ids (one per pipeline actor). Order = R&D → Surveillance → Human. */
export type NodeId =
  | "adversary" // R&D desk (red team)
  | "bridge" // SanitizedBridge — the Chinese wall
  | "anomaly_detector"
  | "investigator" // the one that goes BLUE waiting on Band
  | "specialist"
  | "prosecution"
  | "defense"
  | "adjudicator"
  | "rule_engine"
  | "escalation_manager"
  | "human";

/** Per-node live status the TopologyGraph renders. */
export type NodeStatus = "idle" | "active" | "waiting_on_band" | "done";

export interface NodeView {
  id: NodeId;
  label: string;
  desk: Desk;
  status: NodeStatus;
  /** latest human-readable content for this node, if any. */
  detail: string | null;
  modelTier: "frontier" | "open" | "deterministic" | null;
}

/** A directed Band/pipeline edge between two nodes, lit when traffic flows. */
export interface EdgeView {
  from: NodeId;
  to: NodeId;
  /** BandKind label, or null for an in-desk step. */
  kind: import("../types").BandKind | null;
  active: boolean;
}

/** The single case currently on the desk (one-at-a-time model). */
export interface CaseView {
  id: string | null;
  state: CaseState | null;
  verdict: Verdict | null;
  family: string | null;
}

/** Prosecution ⚔ Defense pair for the debate panel. */
export interface DebateView {
  prosecution: Dossier | null;
  defense: Dossier | null;
}

/** One verdict-timeline dot. */
export interface TimelineDot {
  id: string;
  label: string;
  /** drives color: pass=emerald flag=red escalate=amber complete/closed=green band=blue */
  tone: "pass" | "flag" | "escalate" | "complete" | "band" | "neutral";
  ts: string;
}

/** Everything a component needs, folded from the raw event stream. */
export interface DeskModel {
  case: CaseView;
  nodes: NodeView[];
  edges: EdgeView[];
  rules: Rule[];
  stats: Stats;
  debate: DebateView;
  timeline: TimelineDot[];
  /** node id currently lit, or null. */
  activeNode: NodeId | null;
  /** true while the investigator is round-tripping the Band (drives the blue pulse). */
  bandWaiting: boolean;
  /** true once the 5th rule has been codified (drives the 4→5 reveal). */
  codified: boolean;
}

/** Imperative demo/HITL actions. Mock now (scripted fixtures); live POSTs later. */
export interface DeskController {
  /** clean known-pattern layering → instant FLAGGED. */
  runBeatA(): void;
  /** novel 400ms evasion → PASS → ESCALATED (awaits confirm). */
  runBeatB(): void;
  /** R&D lane — stubbed (POST /demo/rnd not built). No-op + console note for now. */
  runRnD(): void;
  /** ESCALATED → FLAGGED: appends the codify tail (5th rule + regression-gate ✓). */
  confirm(): Promise<void>;
  /** ESCALATED → CLOSED: codifies nothing. */
  reject(): Promise<void>;
  /** clear the stream and return to idle. */
  resetDesk(): void;
}

/** Audit-drawer view (hash-chain verifier). */
export interface AuditView {
  caseId: string | null;
  entries: LedgerEntry[];
  verified: boolean;
}
