"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { IS_MOCK } from "@/lib/config";
import { useTraceStore } from "@/lib/store/useTraceStore";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskController, getAuditView } from "@/lib/desk/controller";
import { useInvalidateOnMarkers } from "@/lib/api/queries";
import { useHotkeys } from "@/lib/desk/useHotkeys";
import { useSoundCues } from "@/lib/desk/useSoundCues";
import DeskHeader from "@/components/desk/DeskHeader";
import ErrorBanner from "@/components/desk/ErrorBanner";
import StatsBar from "@/components/desk/StatsBar";
import ReplayTransport from "@/components/desk/transport/ReplayTransport";
import { TopologyGraph } from "@/components/desk/topology/TopologyGraph";
import HITLControls from "@/components/desk/HITLControls";
import DossierCards from "@/components/desk/DossierCards";
import VerdictTimeline from "@/components/desk/VerdictTimeline";
import RuleRegistryPanel from "@/components/desk/RuleRegistryPanel";
import AuditDrawer from "@/components/desk/AuditDrawer";
import SearchBar from "@/components/desk/SearchBar";
import FilterChips from "@/components/desk/FilterChips";
import NodeTrace from "@/components/desk/NodeTrace";
import HotkeyLegend from "@/components/desk/HotkeyLegend";

/**
 * LiveCommandCenter - the functional Command Center (FRONTEND_BUILD_PLAN §9).
 *
 * Composition only. State flows: fixtures → controller.play → useTraceStore →
 * useDeskModel → components. The controller drives mock playback, so we auto-run
 * Beat B once on mount for an out-of-box demo (novel evasion → PASS → ESCALATED,
 * awaiting the human Confirm that codifies rule 4→5). DemoControls in the header
 * re-trigger Beat A / Beat B / Reset.
 *
 * Embedded as the finale of the /desk showcase scroll-story; swap to live with
 * NEXT_PUBLIC_DATA_MODE=live (the contract.ts seam holds, zero component changes).
 */
export function LiveCommandCenter() {
  const model = useDeskModel();
  const controller = useDeskController();
  const connect = useTraceStore((s) => s.connect);
  const connection = useTraceStore((s) => s.connection);
  const eventCount = useTraceStore((s) => s.events.length);
  const [auditOpen, setAuditOpen] = useState(false);
  const booted = useRef(false);
  const reduce = useReducedMotion() ?? false;

  // LIVE mode boots into an idle, connected desk: nothing happens until a demo
  // trigger in DeskHeader fires. Hint the user, and dismiss the moment the first
  // event lands (eventCount > 0). Never shown in mock playback.
  const showLiveHint =
    !IS_MOCK && connection === "connected" && eventCount === 0;

  useInvalidateOnMarkers();
  useHotkeys();
  useSoundCues();

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (IS_MOCK) {
      controller.runBeatB();
    } else {
      connect();
    }
    return () => controller.resetDesk();
    // run once on mount; store/controller actions are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="live-desk" className="flex min-h-screen flex-col bg-page text-frost">
      <DeskHeader onOpenAudit={() => setAuditOpen(true)} />
      <ErrorBanner />
      <StatsBar />
      {IS_MOCK ? <ReplayTransport /> : null}

      <div className="grid flex-1 grid-cols-1 gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)]">
        <section
          aria-label="Surveillance pipeline topology"
          className="relative min-h-[420px] sm:min-h-[560px]"
        >
          <TopologyGraph />
          {showLiveHint ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              style={{
                backgroundColor: "color-mix(in srgb, var(--bg-page) 55%, transparent)",
                transition: reduce ? undefined : "opacity 0.3s var(--ease-out)",
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  color: "var(--text-muted)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--r-chip)",
                  padding: "10px 16px",
                }}
              >
                Click a demo to begin.
              </div>
            </div>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-4 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto">
          <SearchBar />
          <FilterChips />
          <HITLControls />
          <NodeTrace />
          <DossierCards />
          <VerdictTimeline />
          <RuleRegistryPanel />
        </aside>
      </div>

      <HotkeyLegend />

      <AuditDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        audit={getAuditView(model.case.id)}
      />
    </section>
  );
}
