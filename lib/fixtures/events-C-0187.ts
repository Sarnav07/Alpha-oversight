import type { ActivityEvent } from "../types";

/**
 * Mock SSE stream for case C-0187 (the demo "Beat A" — a 400ms layering-evasion
 * sequence the adversary invents and surveillance flags). Mirrors the backend's
 * replay JSONL format so mock cadence == live cadence == replay cadence (one code path).
 * Replace with backend `GET /stream` by setting NEXT_PUBLIC_DATA_MODE=live.
 */
export const fixtureEventsC0187: ActivityEvent[] = [
  {
    agent_name: "adversary",
    model_id: "rnd-open",
    desk: "rnd",
    content: "proposes 400ms layering-evasion sequence on Market #0",
    reasoning: "thin top-of-book, cancel before fill to dodge cancel-ratio rules",
    tool_calls: [],
    created_at: "2026-06-15T10:23:41Z",
    case_id: "C-0187",
  },
  {
    agent_name: "anomaly_detector",
    model_id: "surv-open",
    desk: "surveillance",
    content: "anomaly: cancel_to_fill=0.94 depth_levels=5",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:23:42Z",
    case_id: "C-0187",
  },
  {
    agent_name: "investigator",
    model_id: "surv-open",
    desk: "surveillance",
    content: "handoff: waiting on Band — recruit @layer-spec",
    reasoning: "needs a layering specialist; round-trips across the Band",
    tool_calls: [{ kind: "band_handoff", to: "specialist" }],
    created_at: "2026-06-15T10:23:42Z",
    case_id: "C-0187",
  },
  {
    agent_name: "specialist",
    model_id: "surv-frontier",
    desk: "surveillance",
    content: "proposes layering match on window_ms<450 with intent",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:23:43Z",
    case_id: "C-0187",
  },
  {
    agent_name: "prosecution",
    model_id: "prosecution-frontier",
    desk: "surveillance",
    content: "400ms cancel after partial fill = intent to evade",
    reasoning: "sub-second cancel after partial fill indicates manipulative intent",
    tool_calls: [],
    created_at: "2026-06-15T10:23:45Z",
    case_id: "C-0187",
  },
  {
    agent_name: "defense",
    model_id: "defense-open",
    desk: "surveillance",
    content: "gap is bona-fide venue latency; depth genuine",
    reasoning: "400ms within venue round-trip; no self-match",
    tool_calls: [],
    created_at: "2026-06-15T10:23:46Z",
    case_id: "C-0187",
  },
  {
    agent_name: "rule_engine",
    model_id: "deterministic",
    desk: "surveillance",
    content: "verdict=FLAG rule=LAYER-002 cited{gap_ms:400}",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:23:47Z",
    case_id: "C-0187",
  },
  {
    agent_name: "escalation_manager",
    model_id: "escalation-frontier",
    desk: "surveillance",
    content: "escalate: recommend confirm — candidate novel rule LAYER-005",
    reasoning: null,
    tool_calls: [{ kind: "band_escalation", to: "human" }],
    created_at: "2026-06-15T10:23:48Z",
    case_id: "C-0187",
  },
];
