import type { ActivityEvent } from "../types";

/**
 * Beat B - case C-0187. The headline demo: a NOVEL 400ms layering evasion the
 * adversary invents to slip the 100ms seed rule. Surveillance debates it, the
 * deterministic engine returns verdict=PASS (the evasion worked), the escalation
 * manager kicks it to a human, and the case ESCALATES awaiting confirmation.
 *
 * MARKER GRAMMAR (mock == live == replay): the surveillance `pipeline` frames
 * carry the EXACT backend marker strings parseMarker.ts consumes -
 *   opened case <id>
 *   suspicious -> UNDER_REVIEW; features={...python repr...}
 *   recruited @layer-spec (layering)   (+ "waiting on band" → blue pulse)
 *   debate complete
 *   verdict=PASS rule=None
 *   case <id> -> ESCALATED
 * Real agents emit CLASS NAMES (AnomalyDetector, Investigator, …); Band-handoff
 * frames use the lowercase sender (investigator, @layer-spec, escalation).
 * nodeIdForAgent lowercases + maps both. Every frame carries case_id.
 */
export const fixtureBeatB: ActivityEvent[] = [
  {
    agent_name: "adversary",
    model_id: "rnd-open",
    desk: "rnd",
    content: "adversary proposes a novel 400ms layering-evasion on Market #0",
    reasoning: "stretch the cancel cluster past the 100ms seed window to dodge the rule",
    tool_calls: [],
    created_at: "2026-06-15T10:23:41Z",
    case_id: "C-0187",
  },
  {
    agent_name: "bridge",
    model_id: "",
    desk: "rnd",
    content: "@anomaly_detector handoff: sanitized order flow crosses the Band (events only)",
    reasoning: null,
    tool_calls: [{ kind: "band_handoff", to: "anomaly_detector" }],
    created_at: "2026-06-15T10:23:42Z",
    case_id: "C-0187",
  },
  {
    agent_name: "pipeline",
    model_id: "",
    desk: "surveillance",
    content: "opened case C-0187",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:23:42.5Z",
    case_id: "C-0187",
  },
  {
    agent_name: "AnomalyDetector",
    model_id: "surv-open",
    desk: "surveillance",
    content:
      "suspicious -> UNDER_REVIEW; features={'cancel_to_fill': 0.94, 'depth_levels': 5, 'self_match_ratio': 0.0, 'eod_print_spike': False}",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:23:43Z",
    case_id: "C-0187",
  },
  {
    agent_name: "investigator",
    model_id: "surv-open",
    desk: "surveillance",
    content: "@layer-spec waiting on band - recruited @layer-spec (layering)",
    reasoning: "needs a layering specialist; round-trips the recruit handoff across the Band",
    tool_calls: [{ kind: "band_handoff", to: "specialist" }],
    created_at: "2026-06-15T10:23:44Z",
    case_id: "C-0187",
  },
  {
    agent_name: "Specialist",
    model_id: "surv-frontier",
    desk: "surveillance",
    content: "@layer-spec propose: contested window_ms~400 layering inputs",
    reasoning: "proposes the contested inputs; does not decide guilt",
    tool_calls: [],
    created_at: "2026-06-15T10:23:45Z",
    case_id: "C-0187",
  },
  {
    agent_name: "Prosecution",
    model_id: "prosecution-frontier",
    desk: "surveillance",
    content: "400ms cancel after partial fill = intent to evade",
    reasoning: "sub-second cancel after partial fill indicates manipulative intent",
    tool_calls: [],
    created_at: "2026-06-15T10:23:46Z",
    case_id: "C-0187",
  },
  {
    agent_name: "Defense",
    model_id: "defense-open",
    desk: "surveillance",
    content: "gap is bona-fide venue latency; depth genuine",
    reasoning: "400ms within venue round-trip; no self-match",
    tool_calls: [],
    created_at: "2026-06-15T10:23:47Z",
    case_id: "C-0187",
  },
  {
    agent_name: "pipeline",
    model_id: "",
    desk: "surveillance",
    content: "debate complete",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:23:47.5Z",
    case_id: "C-0187",
  },
  {
    agent_name: "rule_engine",
    model_id: "deterministic",
    desk: "surveillance",
    content: "verdict=PASS rule=None",
    reasoning: "seed window too tight - gap_ms=400 sits outside window_ms=100",
    tool_calls: [],
    created_at: "2026-06-15T10:23:48Z",
    case_id: "C-0187",
  },
  {
    agent_name: "EscalationManager",
    model_id: "escalation-frontier",
    desk: "surveillance",
    content: "case C-0187 -> ESCALATED",
    reasoning: "rules missed a confirmed-profitable evasion; route to human",
    tool_calls: [{ kind: "band_escalation", to: "human" }],
    created_at: "2026-06-15T10:23:49Z",
    case_id: "C-0187",
  },
];
