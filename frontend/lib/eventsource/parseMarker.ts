import type { ActivityEvent, CaseState } from "../types";

/**
 * The backend emits human-readable strings in `content` (the `agent_name:"pipeline"`
 * surveillance frames carry the canonical markers). This util centralizes the brittle
 * parsing so topology + timeline read `Marker`, never raw strings.
 *
 * Real `/stream` marker strings (tasks/BACKEND_INTEGRATION.md §SSE):
 *   opened case <case_id>
 *   detector clean -> CLOSED
 *   suspicious -> UNDER_REVIEW; features={...python repr...}
 *   recruited <handle> (<family>)
 *   debate complete
 *   verdict=<PASS|FLAG> rule=<rule_id|None>
 *   case <case_id> -> <FINAL_STATE>
 *
 * Band-handoff frames carry "@mention ... waiting on band" content → waiting_on_band.
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
  /** terminal `case <id> -> <FINAL_STATE>` marker (CLOSED | FLAGGED | ESCALATED | …). */
  finalState?: CaseState;
  /** the recruited specialist's family, e.g. "layering" (from `recruited X (layering)`). */
  family?: string;
  /** the case id parsed from `opened case <id>` / `case <id> -> <state>` markers.
   *  Live `/stream` frames carry NO `case_id` field (backend `ActivityEvent` omits
   *  it — see surveillance_pipeline.py); the id lives only inside `content`. */
  caseId?: string;
  /** parsed `features={...}` python-repr dict (suspicious frame). Numbers, bools, strings. */
  features?: Record<string, number | boolean | string>;
}

/** The 5 backend CaseState enum values — used to validate the `case <id> -> X` tail. */
const FINAL_STATES: ReadonlySet<string> = new Set([
  "OPEN",
  "UNDER_REVIEW",
  "FLAGGED",
  "ESCALATED",
  "CLOSED",
]);

/**
 * Parse a python `repr` dict body (the chars between `{` and `}`) per-key with regex.
 * It is NOT JSON: bools are `True`/`False`, keys/strings use single quotes.
 * e.g. `'cancel_to_fill': 0.0, 'depth_levels': 4, 'eod_print_spike': False`
 */
function parsePyReprDict(body: string): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  // 'key': <value>  — value is a number, True/False, or a single-quoted string.
  const re = /'([^']+)'\s*:\s*(True|False|-?\d+(?:\.\d+)?|'[^']*')/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(body)) !== null) {
    const key = mm[1];
    const raw = mm[2];
    if (raw === "True") out[key] = true;
    else if (raw === "False") out[key] = false;
    else if (raw.startsWith("'")) out[key] = raw.slice(1, -1);
    else out[key] = Number(raw);
  }
  return out;
}

export function parseMarker(e: ActivityEvent): Marker {
  const raw = e.content ?? "";
  const c = raw.toLowerCase();
  const m: Marker = {};

  // opened case <case_id>  → bind the case id. Backend SSE frames have no case_id
  // field, so this marker (and the terminal one below) is the ONLY source of it.
  const opened = raw.match(/opened case\s+(\S+)/i);
  if (opened) m.caseId = opened[1].replace(/[.,;]+$/, "");

  // suspicious -> UNDER_REVIEW; features={...}  → anomaly stage + parsed features.
  if (/suspicious\s*->\s*under_review/.test(c)) {
    m.stage = "anomaly";
    m.eventType = "evidence";
    const dict = raw.match(/features\s*=\s*\{([^}]*)\}/i);
    if (dict) m.features = parsePyReprDict(dict[1]);
  }
  // detector clean -> CLOSED  → the detector dismissed it; surface as a verdict-less close.
  // (no debate stage; the terminal `case X -> CLOSED` carries the close signal.)

  // @mention ... "waiting on band"  → investigator round-tripping the Band (blue pulse).
  if (/waiting on band/.test(c)) m.stage = "waiting_on_band";

  // recruited <handle> (<family>)  → recruit handoff to the specialist. Set AFTER
  // waiting_on_band so recruit wins when one frame carries both tokens (model.ts §76).
  const recruit = raw.match(/recruited\s+(\S+)\s*\(([^)]+)\)/i);
  if (recruit) {
    m.stage = "recruit";
    m.eventType = "handoff";
    m.family = recruit[2].trim().toLowerCase();
  }

  // debate complete  → prosecution ⚔ defense done.
  if (/debate complete/.test(c)) m.stage = "debate";

  // verdict=<PASS|FLAG> rule=<rule_id|None>  → adjudicator verdict.
  const verdict = raw.match(/verdict\s*=\s*(PASS|FLAG)/i);
  if (verdict) {
    m.stage = "verdict";
    m.eventType = "verdict";
    m.result = verdict[1].toUpperCase();
    const rule = raw.match(/rule\s*=\s*(\S+)/i);
    // rule may be the literal `None` (PASS, or FLAG with no codified rule).
    if (rule && rule[1] !== "None") m.ruleId = rule[1].replace(/[.,;]+$/, "");
  }

  // case <case_id> -> <FINAL_STATE>  → terminal transition (CLOSED | FLAGGED | ESCALATED …).
  const fin = raw.match(/case\s+(\S+)\s*->\s*([A-Z_]+)/);
  if (fin && FINAL_STATES.has(fin[2])) {
    m.caseId = fin[1].replace(/[.,;]+$/, "");
    m.finalState = fin[2] as CaseState;
    if (fin[2] === "ESCALATED") {
      m.stage = "escalate";
      m.eventType = "escalation";
    }
  }

  // rule codified (human-confirm tail) → rule_codified.
  if (/codif/.test(c)) {
    m.stage = "codify";
    m.eventType = "rule_codified";
  }

  return m;
}
