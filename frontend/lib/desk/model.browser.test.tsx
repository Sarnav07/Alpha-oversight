import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ActivityEvent, Rule, Stats } from "../types";

/**
 * useDeskModel folds the raw ActivityEvent stream (useTraceStore) + the rule/
 * stats sources into the frozen DeskModel view. These suites pin LIVE mode
 * (config mocked → IS_MOCK=false) so the REST-driven branches — rules.length>4
 * codified, GET /stats counts, and the statsError/rulesError health flags — are
 * exercised; the SSE fold (case/nodes/state) runs identically in both modes.
 */

// LIVE mode: forces useDeskModel onto the useRules()/useStats() query paths and
// makes statsError/rulesError (`!IS_MOCK && isError`) observable.
vi.mock("../config", () => ({
  DATA_MODE: "live",
  API_BASE: "http://localhost:8000",
  IS_MOCK: false,
}));

// Drive rules/stats deterministically — model.ts reads useRules()/useStats().
const useRulesMock = vi.fn();
const useStatsMock = vi.fn();
vi.mock("../api/queries", () => ({
  useRules: () => useRulesMock(),
  useStats: () => useStatsMock(),
}));

import { useDeskModel } from "./model";
import { useTraceStore } from "../store/useTraceStore";
import { SEED_RULES } from "./controller";

/** Minimal UseQueryResult shim — only the fields useDeskModel reads. */
function q<T>(over: { data?: T; isError?: boolean } = {}): UseQueryResult<T> {
  return {
    data: over.data,
    isError: over.isError ?? false,
  } as UseQueryResult<T>;
}

/** Realistic surveillance `pipeline` marker frame; override per case. */
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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function render() {
  return renderHook(() => useDeskModel(), { wrapper });
}

const FIVE_RULES: Rule[] = [
  ...SEED_RULES,
  {
    id: "layering-v2-C-0187",
    family: "layering",
    params: { window_ms: 450, min_depth_levels: 3 },
    provenance: "human:analyst/C-0187",
    status: "ACTIVE",
  },
];

beforeEach(() => {
  // vitest globals are OFF → testing-library auto-cleanup is not registered;
  // unmount prior hooks by hand. Also reset the shared zustand store so events
  // don't leak across tests.
  cleanup();
  useTraceStore.setState({ events: [], latestByAgent: {}, connection: "idle" });
  useRulesMock.mockReset();
  useStatsMock.mockReset();
  // Default: 4 seed rules, no live /stats yet, no errors.
  useRulesMock.mockReturnValue(q<Rule[]>({ data: SEED_RULES }));
  useStatsMock.mockReturnValue(q<Stats>({ data: undefined }));
});

describe("useDeskModel — empty stream", () => {
  it("renders the full topology with no case selected", () => {
    const { result } = render();
    expect(result.current.case.id).toBeNull();
    expect(result.current.case.state).toBeNull();
    // 8 LLM agents + bridge + rule_engine + human = the 11-node canonical topology.
    expect(result.current.nodes).toHaveLength(11);
    expect(result.current.activeNode).toBeNull();
    expect(result.current.stats.total_cases).toBe(0);
    expect(result.current.codified).toBe(false);
    expect(result.current.statsError).toBe(false);
    expect(result.current.rulesError).toBe(false);
  });
});

describe("useDeskModel — case lifecycle from markers", () => {
  it("binds the case id from `opened case <id>`", () => {
    const { result, rerender } = render();
    useTraceStore.getState().pushEvent(ev({ content: "opened case C-0191" }));
    rerender();
    expect(result.current.case.id).toBe("C-0191");
  });

  it("folds a FLAG verdict into case.verdict (result + rule_id)", () => {
    const { result, rerender } = render();
    useTraceStore.getState().pushEvent(ev({ content: "opened case C-0191" }));
    useTraceStore
      .getState()
      .pushEvent(ev({ content: "verdict=FLAG rule=FINRA-5210-layering" }));
    rerender();
    expect(result.current.case.verdict?.result).toBe("FLAG");
    expect(result.current.case.verdict?.rule_id).toBe("FINRA-5210-layering");
  });

  it("transitions to ESCALATED on `case <id> -> ESCALATED`", () => {
    const { result, rerender } = render();
    useTraceStore.getState().pushEvent(ev({ content: "opened case C-0191" }));
    useTraceStore.getState().pushEvent(ev({ content: "case C-0191 -> ESCALATED" }));
    rerender();
    expect(result.current.case.state).toBe("ESCALATED");
  });
});

describe("useDeskModel — live rules / stats / codify reveal", () => {
  it("codified is false with exactly the 4 seed rules", () => {
    const { result } = render();
    expect(result.current.rules).toHaveLength(4);
    expect(result.current.codified).toBe(false);
    expect(result.current.stats.active_rules).toBe(4);
  });

  it("codified flips true once a 5th (human-provenance) rule lands live", () => {
    useRulesMock.mockReturnValue(q<Rule[]>({ data: FIVE_RULES }));
    const { result } = render();
    expect(result.current.rules.length).toBeGreaterThan(4);
    expect(result.current.codified).toBe(true);
    expect(result.current.stats.active_rules).toBe(5);
  });

  it("uses GET /stats counts verbatim, overriding active_rules from the rules list", () => {
    useRulesMock.mockReturnValue(q<Rule[]>({ data: FIVE_RULES }));
    useStatsMock.mockReturnValue(
      q<Stats>({
        data: {
          total_cases: 12,
          by_state: { FLAGGED: 3 },
          flagged: 3,
          escalated: 1,
          active_rules: 99, // intentionally wrong — rules.length must win.
        },
      }),
    );
    const { result } = render();
    expect(result.current.stats.total_cases).toBe(12);
    expect(result.current.stats.flagged).toBe(3);
    expect(result.current.stats.active_rules).toBe(5);
  });
});

describe("useDeskModel — REST health flags (live)", () => {
  it("surfaces statsError when GET /stats errors", () => {
    useStatsMock.mockReturnValue(q<Stats>({ isError: true }));
    const { result } = render();
    expect(result.current.statsError).toBe(true);
    expect(result.current.rulesError).toBe(false);
  });

  it("surfaces rulesError (and falls back to SEED_RULES) when GET /rules errors", () => {
    useRulesMock.mockReturnValue(q<Rule[]>({ isError: true, data: undefined }));
    const { result } = render();
    expect(result.current.rulesError).toBe(true);
    expect(result.current.rules).toHaveLength(SEED_RULES.length);
  });
});
