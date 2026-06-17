/**
 * Core data models - faithful to FRONTEND_SPEC.md (backend contracts).
 * Field names mirror the backend verbatim so the live swap is zero-rework.
 */

export type Desk = "rnd" | "surveillance";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "replay"
  | "error";

/** reused/events.py:ActivityEvent (the SSE frame). */
export interface ActivityEvent {
  agent_name: string;
  model_id: string;
  desk: Desk;
  content: string | null;
  reasoning: string | null;
  tool_calls: Record<string, unknown>[];
  created_at: string;
  /** Q6 - mocked until backend adds it (attributes a frame to a case under concurrency). */
  case_id?: string;
  /** present only in replay streams. */
  replay_ts?: string;
}

/** state_machine.py CaseState - exact backend enum (5 values; CLOSED terminal). */
export type CaseState =
  | "OPEN"
  | "UNDER_REVIEW"
  | "FLAGGED"
  | "ESCALATED"
  | "CLOSED";

export type VerdictResult = "PASS" | "FLAG";

export interface Verdict {
  result: VerdictResult;
  rule_id: string | null;
  cited_metric: Record<string, unknown> | null;
}

export interface Features {
  cancel_to_fill: number;
  depth_levels: number;
  self_match_ratio: number;
  eod_print_spike: boolean;
  /** added at the terminal transition (FLAGGED/ESCALATED) - the codified family. */
  family?: RuleFamily | string;
}

export interface ResolvedInputs {
  window_ms: number;
  bona_fide_ids: string[];
  intent: string;
}

export interface Case {
  /** backend uses case_id (== room_id == Band task_id). */
  case_id: string;
  room_id: string;
  state: CaseState;
  verdict: Verdict | null;
  features: Features | null;
  resolved_inputs: ResolvedInputs | null;
  /** OrderEvent[] - empty until terminal (FLAGGED/ESCALATED), then the codify sidecar. */
  events: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

export type RuleFamily = "spoofing" | "layering" | "wash_trade" | "marking";
/** rule_contracts.py Rule.status - default "ACTIVE" at boot. */
export type RuleStatus = "ACTIVE" | "SHADOW" | "RETIRED";

export interface Rule {
  id: string;
  family: RuleFamily;
  params: Record<string, unknown>;
  provenance: string;
  status: RuleStatus;
}

export interface Dossier {
  agent_name: string;
  model_id: string;
  headline: string;
  detail: string;
  claimed_inputs: Record<string, unknown>;
}

/** GET /stats */
export interface Stats {
  total_cases: number;
  by_state: Record<string, number>;
  flagged: number;
  escalated: number;
  active_rules: number;
}

/**
 * audit/ledger.py - a Band-handoff ledger leaf. This is the ONLY leaf kind that
 * GET /cases/{id}/audit returns: agent-step leaves carry no case_id and are
 * filtered out server-side, so the audit drawer shows cross-desk Band messages.
 */
export interface LedgerEntry {
  case_id: string;
  kind: BandKind;
  from: string;
  to: string;
  direction: "sent" | "recv";
  sha256: string;
  band_message_id: string | null;
  /** duplicate of band_message_id (the ledger writes both). */
  bmid?: string | null;
  prev_hash: string;
  hash: string;
}

/** GET /cases/{id}/audit */
export interface AuditResponse {
  case_id: string;
  entries: LedgerEntry[];
  verified: boolean;
}

/** band_envelope.py BandKind - edge labels on the topology. */
export type BandKind =
  | "handoff"
  | "evidence"
  | "verdict"
  | "escalation"
  | "rule_codified";

/** POST /cases/{id}/confirm response. */
export interface ConfirmResponse {
  case: Case;
  codified: boolean;
  regression_passed: boolean;
  rule: Rule | null;
}

/** POST /cases/{id}/reject response (now wrapped - was a bare Case before Phase 5c). */
export interface RejectResponse {
  case: Case;
  codified: false;
}

/** POST /demo/beat-a | /demo/beat-b response. */
export interface BeatResponse {
  case_id: string;
  state: CaseState;
  verdict: Verdict | null;
}

/** POST /demo/rnd response - union of adversary-failed vs adversary-succeeded. */
export interface RndResponse {
  confirmed: boolean;
  rounds: number;
  /** present when the adversary found no evade-and-profit sequence. */
  note?: string;
  /** present when confirmed: the surveillance run on the evasion. */
  params?: Record<string, unknown>;
  case_id?: string;
  state?: CaseState;
  verdict?: Verdict | null;
}
