import { API_BASE, IS_MOCK } from "../config";
import type {
  AuditResponse,
  Case,
  ConfirmResponse,
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

// ---- mock REST fixtures (Q3/Q9 gaps mocked until backend ready) ----
const MOCK_RULES: Rule[] = [
  { id: "SPOOF-001", family: "spoofing", params: { min_cancel_ratio: 0.8 }, provenance: "seed", status: "ACTIVE" },
  { id: "LAYER-002", family: "layering", params: { window_ms: 100, min_depth_levels: 3 }, provenance: "seed", status: "ACTIVE" },
  { id: "WASH-003", family: "wash_trade", params: { min_self_match_ratio: 0.5 }, provenance: "seed", status: "ACTIVE" },
  { id: "MARK-004", family: "marking", params: { min_print_move_bps: 100.0 }, provenance: "seed", status: "ACTIVE" },
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
  reject: (id: string) => post<{ case: Case }>(`/cases/${id}/reject`),
  // demo triggers (parameterless POSTs)
  beatA: () => post<unknown>("/demo/beat-a"),
  beatB: () => post<unknown>("/demo/beat-b"),
  rnd: () => post<unknown>("/demo/rnd"), // Q2 — route not yet on backend
};
