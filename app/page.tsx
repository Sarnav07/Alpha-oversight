"use client";

import { useEffect } from "react";
import { useTraceStore } from "@/lib/store/useTraceStore";
import { parseMarker } from "@/lib/eventsource/parseMarker";
import { DATA_MODE } from "@/lib/config";
import type { ActivityEvent, ConnectionState } from "@/lib/types";

/**
 * FOUNDATION PROOF — minimal Command Center.
 * Connects the EventSource adapter → Zustand store → renders the live feed.
 * Real components (StatsBar, TopologyGraph, RuleRegistry, VerdictTimeline) land
 * next per FRONTEND_BUILD_PLAN.md §9. This proves the swap-proof data loop works.
 */
export default function CommandCenter() {
  const events = useTraceStore((s) => s.events);
  const connection = useTraceStore((s) => s.connection);
  const connect = useTraceStore((s) => s.connect);
  const disconnect = useTraceStore((s) => s.disconnect);
  const reset = useTraceStore((s) => s.reset);

  useEffect(() => {
    reset();
    connect();
    return () => disconnect();
  }, [connect, disconnect, reset]);

  return (
    <main className="min-h-screen bg-page text-frost">
      {/* nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-[var(--hairline)]">
        <div className="flex items-center gap-2 font-semibold tracking-wide">
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-b-0 rounded-t-[9px]" />
          ALPHA &amp; OVERSIGHT
          <span className="font-mono text-[10px] text-faint ml-2">LIVE DESK</span>
        </div>
        <ConnectionStatus state={connection} />
      </nav>

      <div className="px-8 py-6 max-w-[var(--maxw-content)] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
            Foundation proof · data mode: {DATA_MODE}
          </p>
          <p className="font-mono text-[11px] text-faint">
            events: {events.length}
          </p>
        </div>

        {/* live activity feed */}
        <section
          className="rounded-[14px] border border-[var(--border-subtle)] bg-card p-4"
          aria-label="Live activity feed"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Live activity feed
            </span>
            <span className="font-mono text-[10px] text-faint">prepend ▲</span>
          </div>

          {events.length === 0 ? (
            <p className="text-muted text-sm py-6 text-center">
              {connection === "connecting"
                ? "connecting to stream…"
                : "waiting for first frame…"}
            </p>
          ) : (
            <ul className="flex flex-col">
              {[...events].reverse().map((e, i) => (
                <FeedRow key={`${e.agent_name}-${e.created_at}-${i}`} e={e} />
              ))}
            </ul>
          )}
        </section>

        <p className="font-mono text-[10px] text-faint mt-4">
          ✓ adapter → store → render loop is live. Set NEXT_PUBLIC_DATA_MODE=live
          to stream from the FastAPI backend (zero component changes).
        </p>
      </div>
    </main>
  );
}

function FeedRow({ e }: { e: ActivityEvent }) {
  const m = parseMarker(e);
  const isWaiting = m.stage === "waiting_on_band";
  const isFlag = m.result === "FLAG";
  const deskColor =
    e.desk === "rnd" ? "var(--desk-rnd)" : "var(--desk-surv)";

  return (
    <li className="anim-fade-up border-b border-[var(--hairline)] last:border-0 py-2.5">
      <div className="flex items-center gap-2 text-sm">
        <span style={{ color: deskColor }}>◢ {e.agent_name}</span>
        <ModelBadge modelId={e.model_id} />
        <span className="font-mono text-[10px] text-faint ml-auto">
          {e.created_at.slice(11, 19)}
        </span>
      </div>
      <p
        className="font-mono text-[11px] mt-1"
        style={{
          color: isWaiting
            ? "#cfe0ff"
            : isFlag
              ? "#ffb4b4"
              : "var(--text-body)",
        }}
      >
        {isWaiting ? "▓ waiting on Band ▓ — " : ""}
        {e.content}
      </p>
    </li>
  );
}

function ModelBadge({ modelId }: { modelId: string }) {
  const frontier = modelId.includes("frontier");
  return (
    <span
      className="font-mono text-[9px] px-1.5 py-0.5 rounded-[4px] border"
      style={{
        color: frontier ? "var(--tier-frontier)" : "var(--tier-open)",
        borderColor: frontier ? "#5a4d22" : "var(--border-default)",
        background: frontier ? "#3a3320" : "#1a1c20",
      }}
    >
      ▸ {frontier ? "frontier" : "open"}
    </span>
  );
}

function ConnectionStatus({ state }: { state: ConnectionState }) {
  const map: Record<ConnectionState, { c: string; label: string }> = {
    idle: { c: "var(--status-idle)", label: "idle" },
    connecting: { c: "var(--verdict-escalate)", label: "connecting" },
    connected: { c: "var(--verdict-complete)", label: "Band: connected" },
    reconnecting: { c: "var(--verdict-escalate)", label: "reconnecting" },
    replay: { c: "var(--verdict-escalate)", label: "replay" },
    error: { c: "var(--verdict-flag)", label: "error" },
  };
  const s = map[state];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] px-3 py-1 text-[11px]">
      <span
        className="w-[7px] h-[7px] rounded-full"
        style={{ background: s.c }}
      />
      {s.label}
    </span>
  );
}
