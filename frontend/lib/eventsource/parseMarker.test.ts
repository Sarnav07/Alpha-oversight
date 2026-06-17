import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActivityEvent } from "../types";
import { latestCaseId, parseMarker } from "./parseMarker";

/**
 * Build a realistic ActivityEvent. Defaults mirror a surveillance `pipeline`
 * frame (the canonical marker carrier); override `content`/`agent_name`/etc.
 * per case. Live `/stream` frames carry NO `case_id` field, so it is omitted by
 * default and only set when a fixture explicitly attributes a frame to a case.
 */
function ev(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    agent_name: "pipeline",
    model_id: "",
    desk: "surveillance",
    content: null,
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T11:02:11Z",
    ...overrides,
  };
}

describe("parseMarker - recognised markers", () => {
  it("`opened case <id>` binds the caseId and sets no stage", () => {
    const m = parseMarker(ev({ content: "opened case C-0191" }));
    expect(m.caseId).toBe("C-0191");
    expect(m.stage).toBeUndefined();
    expect(m.eventType).toBeUndefined();
  });

  it("strips trailing punctuation off the opened caseId", () => {
    const m = parseMarker(ev({ content: "opened case C-0191." }));
    expect(m.caseId).toBe("C-0191");
  });

  it("`suspicious -> UNDER_REVIEW; features={...}` → anomaly + parsed features", () => {
    const m = parseMarker(
      ev({
        agent_name: "AnomalyDetector",
        content:
          "suspicious -> UNDER_REVIEW; features={'cancel_to_fill': 0.91, 'depth_levels': 5, 'self_match_ratio': 0.0, 'eod_print_spike': False}",
      }),
    );
    expect(m.stage).toBe("anomaly");
    expect(m.eventType).toBe("evidence");
    expect(m.features).toEqual({
      cancel_to_fill: 0.91,
      depth_levels: 5,
      self_match_ratio: 0.0,
      eod_print_spike: false,
    });
  });

  it("parses True/False and single-quoted string values in the python-repr dict", () => {
    const m = parseMarker(
      ev({
        agent_name: "AnomalyDetector",
        content:
          "suspicious -> UNDER_REVIEW; features={'eod_print_spike': True, 'family': 'layering'}",
      }),
    );
    expect(m.features).toEqual({ eod_print_spike: true, family: "layering" });
  });

  it("anomaly frame without a features dict leaves features undefined", () => {
    const m = parseMarker(
      ev({ agent_name: "AnomalyDetector", content: "suspicious -> UNDER_REVIEW" }),
    );
    expect(m.stage).toBe("anomaly");
    expect(m.features).toBeUndefined();
  });

  it("`waiting on band` → waiting_on_band stage", () => {
    const m = parseMarker(
      ev({ agent_name: "investigator", content: "@layer-spec waiting on band" }),
    );
    expect(m.stage).toBe("waiting_on_band");
    expect(m.eventType).toBeUndefined();
  });

  it("`recruited <handle> (<family>)` → recruit handoff with lowercased family", () => {
    const m = parseMarker(
      ev({ agent_name: "investigator", content: "recruited @layer-spec (Layering)" }),
    );
    expect(m.stage).toBe("recruit");
    expect(m.eventType).toBe("handoff");
    expect(m.family).toBe("layering");
  });

  it("recruit wins over waiting_on_band when one frame carries both tokens", () => {
    const m = parseMarker(
      ev({
        agent_name: "investigator",
        content: "@layer-spec waiting on band - recruited @layer-spec (layering)",
      }),
    );
    expect(m.stage).toBe("recruit");
    expect(m.family).toBe("layering");
  });

  it("`debate complete` → debate stage", () => {
    const m = parseMarker(ev({ content: "debate complete" }));
    expect(m.stage).toBe("debate");
  });

  it("`verdict=PASS rule=None` → verdict stage, PASS result, no ruleId", () => {
    const m = parseMarker(
      ev({ agent_name: "rule_engine", content: "verdict=PASS rule=None" }),
    );
    expect(m.stage).toBe("verdict");
    expect(m.eventType).toBe("verdict");
    expect(m.result).toBe("PASS");
    expect(m.ruleId).toBeUndefined();
  });

  it("`verdict=FLAG rule=<id>` → verdict stage, FLAG result, ruleId set", () => {
    const m = parseMarker(
      ev({ agent_name: "rule_engine", content: "verdict=FLAG rule=FINRA-5210-layering" }),
    );
    expect(m.stage).toBe("verdict");
    expect(m.eventType).toBe("verdict");
    expect(m.result).toBe("FLAG");
    expect(m.ruleId).toBe("FINRA-5210-layering");
  });

  it("uppercases a lowercased verdict result", () => {
    const m = parseMarker(ev({ content: "verdict=flag rule=None" }));
    expect(m.result).toBe("FLAG");
  });

  it("`case <id> -> FLAGGED` → terminal transition binds caseId + finalState", () => {
    const m = parseMarker(
      ev({ agent_name: "EscalationManager", content: "case C-0191 -> FLAGGED" }),
    );
    expect(m.caseId).toBe("C-0191");
    expect(m.finalState).toBe("FLAGGED");
    // FLAGGED is not the escalate branch - no stage/eventType from the terminal.
    expect(m.stage).toBeUndefined();
    expect(m.eventType).toBeUndefined();
  });

  it("`case <id> -> ESCALATED` → escalate stage + escalation eventType", () => {
    const m = parseMarker(
      ev({ agent_name: "EscalationManager", content: "case C-0207 -> ESCALATED" }),
    );
    expect(m.caseId).toBe("C-0207");
    expect(m.finalState).toBe("ESCALATED");
    expect(m.stage).toBe("escalate");
    expect(m.eventType).toBe("escalation");
  });

  it("`case <id> -> CLOSED` → CLOSED finalState, no escalate stage", () => {
    const m = parseMarker(ev({ content: "case C-0300 -> CLOSED" }));
    expect(m.finalState).toBe("CLOSED");
    expect(m.stage).toBeUndefined();
  });

  it("ignores a `case <id> -> <X>` whose tail is NOT a valid CaseState", () => {
    const m = parseMarker(ev({ content: "case C-0400 -> WAFFLES" }));
    expect(m.finalState).toBeUndefined();
    // and since the terminal regex bailed, no caseId is bound from this marker.
    expect(m.caseId).toBeUndefined();
  });

  it("terminal `case <id> ->` overrides the `opened case <id>` id in the same frame", () => {
    const m = parseMarker(ev({ content: "opened case C-0001; case C-0002 -> CLOSED" }));
    expect(m.caseId).toBe("C-0002");
    expect(m.finalState).toBe("CLOSED");
  });

  it("`codified` tail → codify stage + rule_codified eventType", () => {
    const m = parseMarker(
      ev({ content: "rule FINRA-5210-layering-v2 codified; Active Rules 4 -> 5" }),
    );
    expect(m.stage).toBe("codify");
    expect(m.eventType).toBe("rule_codified");
  });

  it("null content → empty marker (no throw)", () => {
    const m = parseMarker(ev({ content: null }));
    expect(m).toEqual({});
  });

  it("unrelated chatter from a non-pipeline agent → empty marker", () => {
    const m = parseMarker(
      ev({ agent_name: "Prosecution", content: "80ms cancel cluster = layering intent" }),
    );
    expect(m).toEqual({});
  });
});

describe("latestCaseId", () => {
  it("returns null for an empty event list", () => {
    expect(latestCaseId([])).toBeNull();
  });

  it("returns null when nothing carries or parses a case id", () => {
    expect(
      latestCaseId([
        ev({ agent_name: "Prosecution", content: "intent is clear" }),
        ev({ agent_name: "Defense", content: "no bona-fide excuse" }),
      ]),
    ).toBeNull();
  });

  it("prefers a top-level e.case_id when present", () => {
    expect(
      latestCaseId([
        ev({ content: "opened case C-0001", case_id: "C-OVERRIDE" }),
      ]),
    ).toBe("C-OVERRIDE");
  });

  it("falls back to parsing the marker when case_id is absent", () => {
    expect(latestCaseId([ev({ content: "opened case C-0191" })])).toBe("C-0191");
  });

  it("scans newest-first and returns the most recent case id", () => {
    expect(
      latestCaseId([
        ev({ content: "opened case C-0001" }),
        ev({ content: "case C-0001 -> CLOSED" }),
        ev({ content: "opened case C-0002" }),
      ]),
    ).toBe("C-0002");
  });

  it("skips trailing marker-less frames to find the newest parseable id", () => {
    expect(
      latestCaseId([
        ev({ content: "opened case C-0042" }),
        ev({ agent_name: "Prosecution", content: "argument with no case id" }),
        ev({ agent_name: "Defense", content: "rebuttal with no case id" }),
      ]),
    ).toBe("C-0042");
  });

  it("falls back to a parsed terminal id when the newest frame has no case_id field", () => {
    expect(latestCaseId([ev({ content: "case C-0207 -> ESCALATED" })])).toBe("C-0207");
  });
});

describe("parseMarker - DEV warn on unparsed pipeline frames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns when a non-empty `pipeline` frame yields no recognised marker", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    parseMarker(ev({ agent_name: "pipeline", content: "totally unknown surveillance line" }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("totally unknown surveillance line");
  });

  it("does NOT warn for a recognised `pipeline` marker", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    parseMarker(ev({ agent_name: "pipeline", content: "debate complete" }));
    expect(warn).not.toHaveBeenCalled();
  });

  it("does NOT warn for non-pipeline agent chatter (legitimately marker-less)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    parseMarker(ev({ agent_name: "Prosecution", content: "free-form argument, no marker" }));
    expect(warn).not.toHaveBeenCalled();
  });

  it("does NOT warn for an empty/whitespace pipeline frame", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    parseMarker(ev({ agent_name: "pipeline", content: "   " }));
    expect(warn).not.toHaveBeenCalled();
  });
});
