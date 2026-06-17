import type { ActivityEvent } from "../types";

/**
 * Beat A - case C-0191. A clean, KNOWN layering pattern: the cancel cluster
 * sits inside the 100ms seed window, so the deterministic engine FLAGs on the
 * first active rule (FINRA-5210-layering) and the case ends FLAGGED. No
 * escalation, no human - this is the "rules already catch it" lane.
 *
 * MARKER GRAMMAR (mock == live == replay): the surveillance `pipeline` frames
 * carry the EXACT backend marker strings parseMarker.ts consumes -
 *   opened case <id>
 *   suspicious -> UNDER_REVIEW; features={...python repr...}
 *   recruited @layer-spec (layering)
 *   debate complete
 *   verdict=FLAG rule=<id>
 *   case <id> -> FLAGGED
 * Real agents emit CLASS NAMES (AnomalyDetector, Investigator, …); Band-handoff
 * frames use the lowercase sender (investigator, @layer-spec). nodeIdForAgent
 * lowercases + maps both. Every frame carries case_id (Q6 attribution).
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
    agent_name: "pipeline",
    model_id: "",
    desk: "surveillance",
    content: "opened case C-0191",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T11:02:11.5Z",
    case_id: "C-0191",
  },
  {
    agent_name: "AnomalyDetector",
    model_id: "surv-open",
    desk: "surveillance",
    content:
      "suspicious -> UNDER_REVIEW; features={'cancel_to_fill': 0.91, 'depth_levels': 5, 'self_match_ratio': 0.0, 'eod_print_spike': False}",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T11:02:12Z",
    case_id: "C-0191",
  },
  {
    agent_name: "investigator",
    model_id: "surv-open",
    desk: "surveillance",
    content: "@layer-spec waiting on band - recruited @layer-spec (layering)",
    reasoning: "recruits the layering specialist; round-trips the handoff across the Band",
    tool_calls: [{ kind: "band_handoff", to: "specialist" }],
    created_at: "2026-06-15T11:02:13Z",
    case_id: "C-0191",
  },
  {
    agent_name: "Specialist",
    model_id: "surv-frontier",
    desk: "surveillance",
    content: "@layer-spec propose: window_ms~80 layering inputs, depth_levels=5",
    reasoning: "proposes the contested inputs; does not decide guilt",
    tool_calls: [],
    created_at: "2026-06-15T11:02:14Z",
    case_id: "C-0191",
  },
  {
    agent_name: "Prosecution",
    model_id: "prosecution-frontier",
    desk: "surveillance",
    content: "80ms cancel cluster across 5 levels = classic layering intent",
    reasoning: "tight cancel window inside the seed threshold; clear manipulative intent",
    tool_calls: [],
    created_at: "2026-06-15T11:02:15Z",
    case_id: "C-0191",
  },
  {
    agent_name: "Defense",
    model_id: "defense-open",
    desk: "surveillance",
    content: "no bona-fide latency excuse at 80ms; depth is layered not genuine",
    reasoning: "concedes the window sits inside the rule threshold",
    tool_calls: [],
    created_at: "2026-06-15T11:02:16Z",
    case_id: "C-0191",
  },
  {
    agent_name: "pipeline",
    model_id: "",
    desk: "surveillance",
    content: "debate complete",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T11:02:16.5Z",
    case_id: "C-0191",
  },
  {
    agent_name: "rule_engine",
    model_id: "deterministic",
    desk: "surveillance",
    content: "verdict=FLAG rule=FINRA-5210-layering",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T11:02:17Z",
    case_id: "C-0191",
  },
  {
    agent_name: "EscalationManager",
    model_id: "escalation-frontier",
    desk: "surveillance",
    content: "case C-0191 -> FLAGGED",
    reasoning: "rules fired, no human needed",
    tool_calls: [{ kind: "band_verdict", to: "human" }],
    created_at: "2026-06-15T11:02:18Z",
    case_id: "C-0191",
  },
];
