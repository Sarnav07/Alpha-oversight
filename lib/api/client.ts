import { API_BASE, IS_MOCK } from "../config";
import type {
  AuditResponse,
  BeatResponse,
  Case,
  ConfirmResponse,
  RejectResponse,
  RndResponse,
  Rule,
  Stats,
} from "../types";

/**
 * REST client for the 6 GETs + 2 POSTs (FRONTEND_SPEC §6).
 * In mock mode it returns bundled fixtures so the UI renders with no backend.
 * Set NEXT_PUBLIC_DATA_MODE=live to hit the FastAPI server.
 */

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

// ---- mock REST fixtures (rendered with no backend) ----
// Aligned to the real /rules + /stats contract: families lowercase, status
// ACTIVE, GET /stats is COUNTS ONLY (narrative tiles stay hard-coded in the UI).
const MOCK_RULES: Rule[] = [
  { id: "spoofing-v1-seed", family: "spoofing", params: { min_cancel_ratio: 0.8 }, provenance: "seed", status: "ACTIVE" },
  { id: "layering-v1-seed", family: "layering", params: { window_ms: 100, min_depth_levels: 3 }, provenance: "seed", status: "ACTIVE" },
  { id: "wash_trade-v1-seed", family: "wash_trade", params: { min_self_match_ratio: 0.5 }, provenance: "seed", status: "ACTIVE" },
  { id: "marking-v1-seed", family: "marking", params: { min_print_move_bps: 100.0 }, provenance: "seed", status: "ACTIVE" },
];

const MOCK_STATS: Stats = {
  total_cases: 12,
  by_state: { FLAGGED: 7, ESCALATED: 2, CLOSED: 3 },
  flagged: 7,
  escalated: 2,
  active_rules: 4,
};

export const api = {
  cases: () => (IS_MOCK ? Promise.resolve<Case[]>([]) : get<Case[]>("/cases")),
  case: (id: string) => get<Case>(`/cases/${id}`),
  audit: (id: string) => get<AuditResponse>(`/cases/${id}/audit`),
  rules: () => (IS_MOCK ? Promise.resolve(MOCK_RULES) : get<Rule[]>("/rules")),
  stats: () => (IS_MOCK ? Promise.resolve(MOCK_STATS) : get<Stats>("/stats")),
  confirm: (id: string) => post<ConfirmResponse>(`/cases/${id}/confirm`),
  // reject is wrapped now: { case, codified:false } — callers read .case.
  reject: (id: string) => post<RejectResponse>(`/cases/${id}/reject`),
  // demo triggers (parameterless POSTs)
  beatA: () => post<BeatResponse>("/demo/beat-a"),
  beatB: () => post<BeatResponse>("/demo/beat-b"),
  rnd: () => post<RndResponse>("/demo/rnd"),
};
