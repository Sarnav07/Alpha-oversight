import { create } from "zustand";
import type { ActivityEvent, ConnectionState } from "../types";
import {
  createAdapter,
  type EventSourceAdapter,
  type AdapterOpts,
} from "../eventsource/adapter";

/**
 * The single live store (FRONTEND_BUILD_PLAN.md §7).
 * One adapter writes here; every component subscribes via selectors.
 * Adapter instance is module-scoped (not in state) to keep state serializable.
 */
let adapter: EventSourceAdapter | null = null;

interface TraceState {
  events: ActivityEvent[];
  connection: ConnectionState;
  /** agent_name -> latest event, for quick node-status lookup. */
  latestByAgent: Record<string, ActivityEvent>;

  connect: (opts?: AdapterOpts) => void;
  disconnect: () => void;
  pushEvent: (e: ActivityEvent) => void;
  setConnection: (s: ConnectionState) => void;
  reset: () => void;
}

export const useTraceStore = create<TraceState>((set, get) => ({
  events: [],
  connection: "idle",
  latestByAgent: {},

  pushEvent: (e) =>
    set((s) => ({
      events: [...s.events, e],
      latestByAgent: { ...s.latestByAgent, [e.agent_name]: e },
    })),

  setConnection: (connection) => set({ connection }),

  connect: (opts) => {
    // Reuse the single long-lived adapter: once a live `/stream` is open, every
    // per-beat connect() (controller.startLive does reset() then connect()) is a
    // no-op so we keep ONE EventSource instead of abort+reopening each beat. A
    // genuine teardown still nulls `adapter` via disconnect(), after which a
    // later connect() opens fresh.
    if (adapter) return;
    adapter = createAdapter(opts);
    adapter.connect({
      onEvent: (e) => get().pushEvent(e),
      onState: (connection) => set({ connection }),
    });
  },

  disconnect: () => {
    adapter?.disconnect();
    adapter = null;
    set({ connection: "idle" });
  },

  reset: () => set({ events: [], latestByAgent: {} }),
}));
