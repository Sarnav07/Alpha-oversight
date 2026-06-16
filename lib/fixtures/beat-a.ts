import type { ActivityEvent } from "../types";

/**
 * Beat A — case C-0191. A clean, KNOWN layering pattern: the cancel cluster
 * sits inside the 100ms seed window, so the deterministic engine FLAGs on the
 * first active rule (FINRA-5210-layering) and the case ends FLAGGED. No
 * escalation, no human — this is the "rules already catch it" lane.
 *
 * Every content string is authored to satisfy parseMarker.ts; every frame
 * carries case_id. Mirrors the backend replay JSONL shape.
 */
export const fixtureBeatA: ActivityEvent[] = [
  {
    agent_name: "adversary",
    model_id: "rnd-open",
    desk: "rnd",
    content: "adversary proposes a textbook 80ms layering pattern on Market #1",
    reasoning: "depth on five levels, cancel cluster inside the 100ms window",
    tool_calls: [],
    created_at: "2026-06-15T11:02:10Z",
    case_id: "C-0191",
  },
  {
    agent_name: "bridge",
    model_id: "",
    desk: "rnd",
    content: "@anomaly_detector handoff: sanitized order flow crosses the Band (events only)",
    reasoning: null,
    tool_calls: [{ kind: "band_handoff", to: "anomaly_detector" }],
    created_at: "2026-06-15T11:02:11Z",
    case_id: "C-0191",
  },
  {
    agent_name: "anomaly_detector",
    model_id: "surv-open",
    desk: "surveillance",
    content: "anomaly: cancel_to_fill=0.91 depth_levels=5 -> suspicious -> UNDER_REVIEW",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T11:02:12Z",
    case_id: "C-0191",
  },
  {
    agent_name: "investigator",
    model_id: "surv-open",
    desk: "surveillance",
    content: "handoff: waiting on Band — recruit @layer-spec (layering)",
    reasoning: "recruits the layering specialist; round-trips the handoff across the Band",
    tool_calls: [{ kind: "band_handoff", to: "specialist" }],
    created_at: "2026-06-15T11:02:13Z",
    case_id: "C-0191",
  },
  {
    agent_name: "specialist",
    model_id: "surv-frontier",
    desk: "surveillance",
    content: "@layer-spec propose: window_ms~80 layering inputs, depth_levels=5",
    reasoning: "proposes the contested inputs; does not decide guilt",
    tool_calls: [],
    created_at: "2026-06-15T11:02:14Z",
    case_id: "C-0191",
  },
  {
    agent_name: "prosecution",
    model_id: "prosecution-frontier",
    desk: "surveillance",
    content: "80ms cancel cluster across 5 levels = classic layering intent",
    reasoning: "tight cancel window inside the seed threshold; clear manipulative intent",
    tool_calls: [],
    created_at: "2026-06-15T11:02:15Z",
    case_id: "C-0191",
  },
  {
    agent_name: "defense",
    model_id: "defense-open",
    desk: "surveillance",
    content: "no bona-fide latency excuse at 80ms; depth is layered not genuine",
    reasoning: "concedes the window sits inside the rule threshold",
    tool_calls: [],
    created_at: "2026-06-15T11:02:16Z",
    case_id: "C-0191",
  },
  {
    agent_name: "rule_engine",
    model_id: "deterministic",
    desk: "surveillance",
    content: "verdict=FLAG rule=FINRA-5210-layering cited{window_ms:80,depth_levels:5}",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T11:02:17Z",
    case_id: "C-0191",
  },
  {
    agent_name: "escalation_manager",
    model_id: "escalation-frontier",
    desk: "surveillance",
    content: "case C-0191 -> FLAGGED (rules fired, no human needed)",
    reasoning: null,
    tool_calls: [{ kind: "band_verdict", to: "human" }],
    created_at: "2026-06-15T11:02:18Z",
    case_id: "C-0191",
  },
];
