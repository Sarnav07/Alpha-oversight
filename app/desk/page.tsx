"use client";

import { useEffect, useRef, useState } from "react";
import { IS_MOCK } from "@/lib/config";
import { useTraceStore } from "@/lib/store/useTraceStore";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskController, getAuditView } from "@/lib/desk/controller";
import { useInvalidateOnMarkers } from "@/lib/api/queries";
import { useHotkeys } from "@/lib/desk/useHotkeys";
import { useSoundCues } from "@/lib/desk/useSoundCues";
import DeskHeader from "@/components/desk/DeskHeader";
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
 * /desk — the live Command Center (FRONTEND_BUILD_PLAN §9, Phase 6).
 *
 * Composition only. All state flows: fixtures → controller.play → useTraceStore
 * → useDeskModel → components. The controller (NOT store.connect) drives mock
 * playback, so we auto-run Beat B once on mount for an out-of-box demo (novel
 * evasion → PASS → ESCALATED, awaiting the human Confirm that codifies rule 4→5).
 * DemoControls in the header re-trigger Beat A / Beat B / Reset.
 *
 * Swap to live: NEXT_PUBLIC_DATA_MODE=live points the controller/adapter at the
 * FastAPI /stream — zero component changes (the contract.ts seam holds).
 */
export default function DeskPage() {
  const model = useDeskModel();
  const controller = useDeskController();
  const connect = useTraceStore((s) => s.connect);
  const [auditOpen, setAuditOpen] = useState(false);
  const booted = useRef(false);

  // live: refetch /stats, /rules, /cases when a state-changing SSE marker arrives.
  useInvalidateOnMarkers();
  // operator keyboard shortcuts (A/B/C/Space/R) + synthesized sound cues.
  useHotkeys();
  useSoundCues();

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (IS_MOCK) {
      // mock: free, instant out-of-box demo (Beat B → ESCALATED, awaiting Confirm).
      // Runs through the ReplayClock, so it's scrubbable mid-flight and the clock —
      // not this page — owns the connection state (an honest "replay").
      controller.runBeatB();
    } else {
      // live: open the real /stream and wait — DemoControls trigger a beat so we
      // don't fire an LLM pipeline on every page load.
      connect();
    }
    return () => controller.resetDesk();
    // run once on mount; store/controller actions are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-page text-frost">
      <DeskHeader onOpenAudit={() => setAuditOpen(true)} />
      <StatsBar />
      {IS_MOCK ? <ReplayTransport /> : null}

      <div className="grid flex-1 grid-cols-1 gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)]">
        {/* centerpiece — keeps a pannable min-height on every breakpoint */}
        <section
          aria-label="Surveillance pipeline topology"
          className="min-h-[420px] sm:min-h-[560px]"
        >
          <TopologyGraph />
        </section>

        {/* right rail — HITL surfaces only when the case is ESCALATED.
            On mobile it stacks below the topology and scrolls with the page. */}
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
    </main>
  );
}
