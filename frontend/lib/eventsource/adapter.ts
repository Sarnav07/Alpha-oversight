import { DATA_MODE, API_BASE } from "../config";
import type { ActivityEvent, ConnectionState } from "../types";
import { framesFor } from "../fixtures/registry";

/**
 * The swap-proof seam (FRONTEND_BUILD_PLAN.md §7).
 * One interface, two implementations. NEXT_PUBLIC_DATA_MODE selects which.
 * Components subscribe to the Zustand store and never know which adapter is live.
 */
export interface StreamHandlers {
  onEvent: (e: ActivityEvent) => void;
  onState: (s: ConnectionState) => void;
}

export interface EventSourceAdapter {
  connect(handlers: StreamHandlers): void;
  disconnect(): void;
}

export interface AdapterOpts {
  /** replay a recorded case (?replay=<case_id>). */
  replay?: string;
  /** ms between mock frames (mock cadence). */
  stepMs?: number;
  /** optional desk filter — only surface frames from this desk (rnd | surveillance). */
  desk?: import("../types").Desk;
}

/** Replays bundled JSONL fixtures at a timed cadence. */
class MockAdapter implements EventSourceAdapter {
  private timers: ReturnType<typeof setTimeout>[] = [];
  constructor(private opts: AdapterOpts = {}) {}

  connect(h: StreamHandlers) {
    const replay = !!this.opts.replay;
    const step = this.opts.stepMs ?? 900;
    h.onState("connecting");
    // simulate a connect handshake then stream frames
    const frames = framesFor(this.opts.replay);
    const open = setTimeout(() => {
      h.onState(replay ? "replay" : "connected");
      frames.forEach((e, i) => {
        const t = setTimeout(() => h.onEvent(e), i * step);
        this.timers.push(t);
      });
    }, 250);
    this.timers.push(open);
  }

  disconnect() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

/** Native EventSource against the FastAPI SSE endpoint. */
class LiveSSEAdapter implements EventSourceAdapter {
  private es?: EventSource;
  constructor(private opts: AdapterOpts = {}) {}

  connect(h: StreamHandlers) {
    h.onState("connecting");
    const url = new URL(`${API_BASE}/stream`);
    if (this.opts.replay) url.searchParams.set("replay", this.opts.replay);
    if (this.opts.desk) url.searchParams.set("desk", this.opts.desk);
    const es = new EventSource(url.toString());
    this.es = es;
    es.onopen = () => h.onState(this.opts.replay ? "replay" : "connected");
    // EventSource natively drops `: keep-alive` heartbeat comments, so onmessage
    // only fires for real `data:` frames (ActivityEvent JSON).
    es.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data) as ActivityEvent;
        // Client-side desk guard (in case the backend ignores ?desk).
        if (this.opts.desk && frame.desk && frame.desk !== this.opts.desk) return;
        h.onEvent(frame);
      } catch {
        /* ignore malformed frame */
      }
    };
    // Browser EventSource auto-reconnects on transient drops; surface the state.
    es.onerror = () => h.onState("reconnecting");
  }

  disconnect() {
    this.es?.close();
    this.es = undefined;
  }
}

export function createAdapter(opts: AdapterOpts = {}): EventSourceAdapter {
  return DATA_MODE === "live"
    ? new LiveSSEAdapter(opts)
    : new MockAdapter(opts);
}
