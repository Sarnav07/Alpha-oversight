import type { ActivityEvent } from "../types";

/**
 * Q5 — the backend currently emits human-readable strings in `content`
 * (e.g. "verdict=FLAG rule=LAYER-002"). This util centralizes the brittle parsing
 * so when the backend adds structured `stage`/`event_type` fields it becomes a
 * one-file pass-through. Topology + timeline read Marker, never raw strings.
 */
export interface Marker {
  stage?:
    | "anomaly"
    | "recruit"
    | "waiting_on_band"
    | "propose"
    | "debate"
    | "verdict"
    | "escalate"
    | "codify";
  eventType?: "handoff" | "evidence" | "verdict" | "escalation" | "rule_codified";
  result?: string; // PASS | FLAG
  ruleId?: string;
}

export function parseMarker(e: ActivityEvent): Marker {
  const c = (e.content ?? "").toLowerCase();
  const m: Marker = {};

  const verdict = c.match(/verdict=(\w+)/);
  if (verdict) {
    m.stage = "verdict";
    m.eventType = "verdict";
    m.result = verdict[1].toUpperCase();
  }

  const rule = (e.content ?? "").match(/rule=([\w-]+)/i);
  if (rule) m.ruleId = rule[1];

  if (/waiting on band/.test(c)) m.stage = "waiting_on_band";
  if (/handoff/.test(c)) {
    m.eventType = "handoff";
    if (/recruit/.test(c)) m.stage = "recruit";
  }
  if (/anomaly/.test(c)) m.stage = "anomaly";
  if (/propose/.test(c)) m.stage = "propose";
  if (/escalat/.test(c)) {
    m.stage = "escalate";
    m.eventType = "escalation";
  }
  if (/codif/.test(c)) {
    m.stage = "codify";
    m.eventType = "rule_codified";
  }

  return m;
}
