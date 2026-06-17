import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityEvent, ConnectionState } from "../types";

/**
 * Unit tests for the single live trace store (lib/store/useTraceStore.ts).
 *
 * The store owns a MODULE-SCOPED adapter handle (not in zustand state). We mock
 * the adapter factory so no real EventSource/timers are touched: createAdapter
 * returns a fake { connect, disconnect } whose handlers we can capture and
 * replay. The module-scoped `adapter` guard (`if (adapter) return`) is the
 * behaviour under test for connect() idempotency, so we drive it through the
 * public connect()/disconnect() surface rather than poking the closure.
 */

const fakeAdapter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("../eventsource/adapter", () => ({
  createAdapter: vi.fn(() => fakeAdapter),
}));

// Import AFTER the mock is registered (vi.mock is hoisted, so a static import is
// safe — the store sees the mocked factory).
import { createAdapter } from "../eventsource/adapter";
import { useTraceStore } from "./useTraceStore";

const createAdapterMock = vi.mocked(createAdapter);

/** A realistic SSE frame; override per case. */
function ev(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    agent_name: "anomaly_detector",
    model_id: "Qwen3-Next-80B",
    desk: "surveillance",
    content: null,
    reasoning: null,
    tool_calls: [],
    created_at: "2026-06-15T11:02:11Z",
    ...overrides,
  };
}

describe("useTraceStore", () => {
  beforeEach(() => {
    // Reset the store back to a clean, disconnected baseline. disconnect()
    // nulls the module-scoped adapter so each test starts with a fresh guard.
    useTraceStore.getState().disconnect();
    useTraceStore.setState({
      events: [],
      latestByAgent: {},
      connection: "idle",
    });
    fakeAdapter.connect.mockReset();
    fakeAdapter.disconnect.mockReset();
    createAdapterMock.mockClear();
    createAdapterMock.mockReturnValue(fakeAdapter);
  });

  it("pushEvent appends to events AND tracks latestByAgent per agent", () => {
    const a1 = ev({ agent_name: "anomaly_detector", content: "first" });
    const a2 = ev({ agent_name: "investigator", content: "second" });
    const a3 = ev({ agent_name: "anomaly_detector", content: "third" });

    const { pushEvent } = useTraceStore.getState();
    pushEvent(a1);
    pushEvent(a2);
    pushEvent(a3);

    const s = useTraceStore.getState();
    // Appended in order, nothing dropped.
    expect(s.events).toEqual([a1, a2, a3]);
    expect(s.events).toHaveLength(3);
    // latestByAgent keyed by agent_name, holding the MOST RECENT frame.
    expect(s.latestByAgent.investigator).toBe(a2);
    expect(s.latestByAgent.anomaly_detector).toBe(a3);
    expect(Object.keys(s.latestByAgent).sort()).toEqual([
      "anomaly_detector",
      "investigator",
    ]);
  });

  it("connect() opens the adapter once; a second connect() is a no-op", () => {
    const { connect } = useTraceStore.getState();
    connect();
    connect();

    // The module-scoped `if (adapter) return` guard means exactly one adapter is
    // created and connected — one long-lived EventSource, not abort+reopen.
    expect(createAdapterMock).toHaveBeenCalledTimes(1);
    expect(fakeAdapter.connect).toHaveBeenCalledTimes(1);
  });

  it("connect() wires handlers that drive pushEvent and connection state", () => {
    useTraceStore.getState().connect();

    const handlers = fakeAdapter.connect.mock.calls[0][0] as {
      onEvent: (e: ActivityEvent) => void;
      onState: (s: ConnectionState) => void;
    };

    const frame = ev({ agent_name: "prosecution", content: "evidence" });
    handlers.onEvent(frame);
    handlers.onState("connected");

    const s = useTraceStore.getState();
    expect(s.events).toEqual([frame]);
    expect(s.latestByAgent.prosecution).toBe(frame);
    expect(s.connection).toBe("connected");
  });

  it("disconnect() tears down the adapter, nulls it, and idles the connection", () => {
    const { connect } = useTraceStore.getState();
    connect();
    expect(fakeAdapter.connect).toHaveBeenCalledTimes(1);

    useTraceStore.getState().setConnection("connected");
    useTraceStore.getState().disconnect();

    expect(fakeAdapter.disconnect).toHaveBeenCalledTimes(1);
    expect(useTraceStore.getState().connection).toBe("idle");

    // Because disconnect() nulled the module adapter, a later connect() opens a
    // FRESH adapter (proves the guard was cleared).
    useTraceStore.getState().connect();
    expect(createAdapterMock).toHaveBeenCalledTimes(2);
    expect(fakeAdapter.connect).toHaveBeenCalledTimes(2);
  });

  it("reset() clears events and latestByAgent (but not the adapter)", () => {
    const { pushEvent, reset } = useTraceStore.getState();
    pushEvent(ev({ agent_name: "defense" }));
    pushEvent(ev({ agent_name: "adjudicator" }));
    expect(useTraceStore.getState().events).toHaveLength(2);

    reset();

    const s = useTraceStore.getState();
    expect(s.events).toEqual([]);
    expect(s.latestByAgent).toEqual({});
  });
});
