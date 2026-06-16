/**
 * Core data models — faithful to FRONTEND_SPEC.md (backend contracts).
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
  /** Q6 — mocked until backend adds it (attributes a frame to a case under concurrency). */
  case_id?: string;
  /** present only in replay streams. */
  replay_ts?: string;
}

/** state_machine.py CaseState — exact backend enum (5 values; CLOSED terminal). */
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
}

export interface ResolvedInputs {
  window_ms: number;
  bona_fide_ids: string[];
  intent: string;
}

export interface Case {
  id: string;
  state: CaseState;
  verdict: Verdict | null;
  features: Features | null;
  resolved_inputs: ResolvedInputs | null;
  created_at: string;
  updated_at: string;
}

export type RuleFamily = "spoofing" | "layering" | "wash_trade" | "marking";
/** rule_contracts.py Rule.status — default "ACTIVE" at boot. */
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

/** audit/ledger.py — one hash-chained entry. */
export interface LedgerEntry {
  agent: string;
  desk: Desk | null;
  role: string;
  content_sha256: string;
  band_message_id: string | null;
  prev_hash: string;
  hash: string;
}

/** GET /cases/{id}/audit */
export interface AuditResponse {
  case_id: string;
  entries: LedgerEntry[];
  verified: boolean;
}

/** band_envelope.py BandKind — edge labels on the topology. */
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
