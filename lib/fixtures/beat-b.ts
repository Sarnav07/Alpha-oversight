import type { ActivityEvent } from "../types";

/**
 * Beat B — case C-0187. The headline demo: a NOVEL 400ms layering evasion the
 * adversary invents to slip the 100ms seed rule. Surveillance debates it, the
 * deterministic engine returns verdict=PASS (the evasion worked), the escalation
 * manager kicks it to a human, and the case ESCALATES awaiting confirmation.
 *
 * The investigator frame carries "waiting on band" + "handoff" + "recruit" so
 * parseMarker lights the blue Band pulse and the recruit stage. Every content
 * string is authored to satisfy parseMarker.ts; every frame carries case_id.
 *
 * Mirrors the backend replay JSONL shape so mock cadence == live == replay.
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
    agent_name: "anomaly_detector",
    model_id: "surv-open",
    desk: "surveillance",
    content: "anomaly: cancel_to_fill=0.94 depth_levels=5 -> suspicious -> UNDER_REVIEW",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:23:43Z",
    case_id: "C-0187",
  },
  {
    agent_name: "investigator",
    model_id: "surv-open",
    desk: "surveillance",
    content: "handoff: waiting on Band — recruit @layer-spec (layering)",
    reasoning: "needs a layering specialist; round-trips the recruit handoff across the Band",
    tool_calls: [{ kind: "band_handoff", to: "specialist" }],
    created_at: "2026-06-15T10:23:44Z",
    case_id: "C-0187",
  },
  {
    agent_name: "specialist",
    model_id: "surv-frontier",
    desk: "surveillance",
    content: "@layer-spec propose: contested window_ms~400 layering inputs",
    reasoning: "proposes the contested inputs; does not decide guilt",
    tool_calls: [],
    created_at: "2026-06-15T10:23:45Z",
    case_id: "C-0187",
  },
  {
    agent_name: "prosecution",
    model_id: "prosecution-frontier",
    desk: "surveillance",
    content: "400ms cancel after partial fill = intent to evade",
    reasoning: "sub-second cancel after partial fill indicates manipulative intent",
    tool_calls: [],
    created_at: "2026-06-15T10:23:46Z",
    case_id: "C-0187",
  },
  {
    agent_name: "defense",
    model_id: "defense-open",
    desk: "surveillance",
    content: "gap is bona-fide venue latency; depth genuine",
    reasoning: "400ms within venue round-trip; no self-match",
    tool_calls: [],
    created_at: "2026-06-15T10:23:47Z",
    case_id: "C-0187",
  },
  {
    agent_name: "rule_engine",
    model_id: "deterministic",
    desk: "surveillance",
    content: "verdict=PASS rule=None cited{gap_ms:400,window_ms:100} — seed window too tight",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:23:48Z",
    case_id: "C-0187",
  },
  {
    agent_name: "escalation_manager",
    model_id: "escalation-frontier",
    desk: "surveillance",
    content: "escalate: recommend confirm — novel evasion slipped the rules, awaiting human",
    reasoning: "rules missed a confirmed-profitable evasion; route to human",
    tool_calls: [{ kind: "band_escalation", to: "human" }],
    created_at: "2026-06-15T10:23:49Z",
    case_id: "C-0187",
  },
];
