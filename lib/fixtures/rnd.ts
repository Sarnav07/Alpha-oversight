import type { ActivityEvent } from "../types";

/**
 * R&D lane — case C-0188. The full adversarial loop the Beat-B fixture only
 * hinted at: the R&D adversary iterates evasions against the seed rules in
 * simulation (round 1 @100ms caught, round 2 @250ms caught, round 3 @400ms
 * evades + turns a profit), CONFIRMS the working evasion, then the Sanitized
 * Bridge hands the order flow across the Chinese wall (events only). From there
 * the SAME surveillance pipeline as Beat B runs — debate → deterministic
 * verdict=PASS (the evasion worked) → ESCALATED to a human.
 *
 * The adversary rounds are `desk:"rnd"` narration frames (sniffed for family =
 * layering); the surveillance frames carry the EXACT backend marker grammar
 * parseMarker.ts consumes (mock == live == replay). Every frame carries case_id.
 * Drives "Run R&D" and the R&D swimlane — Beat B no longer has to stand in (Q2).
 */
export const fixtureRnD: ActivityEvent[] = [
  {
    agent_name: "adversary",
    model_id: "rnd-open",
    desk: "rnd",
    content: "round 1/3: 100ms layering burst on Market #0 — caught by FINRA-5210 seed rule",
    reasoning: "cancel cluster sits inside the 100ms seed window; rejected in sim, iterate",
    tool_calls: [],
    created_at: "2026-06-15T10:25:30Z",
    case_id: "C-0188",
  },
  {
    agent_name: "adversary",
    model_id: "rnd-open",
    desk: "rnd",
    content: "round 2/3: 250ms layering burst — still flagged in sim; widen the cancel gap",
    reasoning: "250ms gap is closer but the deterministic engine still trips; push past the window",
    tool_calls: [],
    created_at: "2026-06-15T10:25:32Z",
    case_id: "C-0188",
  },
  {
    agent_name: "adversary",
    model_id: "rnd-open",
    desk: "rnd",
    content: "round 3/3: 400ms layering evasion — evades the seed rule, +2.1% sim profit, CONFIRMED",
    reasoning: "stretches the cancel cluster past the 100ms window; profitable and undetected — escalate to the Band",
    tool_calls: [],
    created_at: "2026-06-15T10:25:34Z",
    case_id: "C-0188",
  },
  {
    agent_name: "bridge",
    model_id: "",
    desk: "rnd",
    content: "@anomaly_detector handoff: sanitized order flow crosses the Band (events only)",
    reasoning: null,
    tool_calls: [{ kind: "band_handoff", to: "anomaly_detector" }],
    created_at: "2026-06-15T10:25:35Z",
    case_id: "C-0188",
  },
  {
    agent_name: "pipeline",
    model_id: "",
    desk: "surveillance",
    content: "opened case C-0188",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:25:35.5Z",
    case_id: "C-0188",
  },
  {
    agent_name: "AnomalyDetector",
    model_id: "surv-open",
    desk: "surveillance",
    content:
      "suspicious -> UNDER_REVIEW; features={'cancel_to_fill': 0.96, 'depth_levels': 5, 'self_match_ratio': 0.0, 'eod_print_spike': False}",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:25:36Z",
    case_id: "C-0188",
  },
  {
    agent_name: "investigator",
    model_id: "surv-open",
    desk: "surveillance",
    content: "@layer-spec waiting on band — recruited @layer-spec (layering)",
    reasoning: "needs a layering specialist; round-trips the recruit handoff across the Band",
    tool_calls: [{ kind: "band_handoff", to: "specialist" }],
    created_at: "2026-06-15T10:25:37Z",
    case_id: "C-0188",
  },
  {
    agent_name: "Specialist",
    model_id: "surv-frontier",
    desk: "surveillance",
    content: "@layer-spec propose: contested window_ms~400 layering inputs",
    reasoning: "proposes the contested inputs; does not decide guilt",
    tool_calls: [],
    created_at: "2026-06-15T10:25:38Z",
    case_id: "C-0188",
  },
  {
    agent_name: "Prosecution",
    model_id: "prosecution-frontier",
    desk: "surveillance",
    content: "400ms cancel after partial fill = intent to evade",
    reasoning: "sub-second cancel after partial fill indicates manipulative intent",
    tool_calls: [],
    created_at: "2026-06-15T10:25:39Z",
    case_id: "C-0188",
  },
  {
    agent_name: "Defense",
    model_id: "defense-open",
    desk: "surveillance",
    content: "gap is bona-fide venue latency; depth genuine",
    reasoning: "400ms within venue round-trip; no self-match",
    tool_calls: [],
    created_at: "2026-06-15T10:25:40Z",
    case_id: "C-0188",
  },
  {
    agent_name: "pipeline",
    model_id: "",
    desk: "surveillance",
    content: "debate complete",
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T10:25:40.5Z",
    case_id: "C-0188",
  },
  {
    agent_name: "rule_engine",
    model_id: "deterministic",
    desk: "surveillance",
    content: "verdict=PASS rule=None",
    reasoning: "seed window too tight — gap_ms=400 sits outside window_ms=100",
    tool_calls: [],
    created_at: "2026-06-15T10:25:41Z",
    case_id: "C-0188",
  },
  {
    agent_name: "EscalationManager",
    model_id: "escalation-frontier",
    desk: "surveillance",
    content: "case C-0188 -> ESCALATED",
    reasoning: "rules missed a confirmed-profitable evasion; route to human",
    tool_calls: [{ kind: "band_escalation", to: "human" }],
    created_at: "2026-06-15T10:25:42Z",
    case_id: "C-0188",
  },
];
