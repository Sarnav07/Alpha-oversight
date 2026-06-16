"use client";

import { useEffect, useRef, useState } from "react";
import { useTraceStore } from "@/lib/store/useTraceStore";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskController, getAuditView } from "@/lib/desk/controller";
import DeskHeader from "@/components/desk/DeskHeader";
import StatsBar from "@/components/desk/StatsBar";
import { TopologyGraph } from "@/components/desk/topology/TopologyGraph";
import HITLControls from "@/components/desk/HITLControls";
import DossierCards from "@/components/desk/DossierCards";
import VerdictTimeline from "@/components/desk/VerdictTimeline";
import RuleRegistryPanel from "@/components/desk/RuleRegistryPanel";
import AuditDrawer from "@/components/desk/AuditDrawer";

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
  const setConnection = useTraceStore((s) => s.setConnection);
  const [auditOpen, setAuditOpen] = useState(false);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    setConnection("connected");
    controller.runBeatB();
    return () => controller.resetDesk();
    // run once on mount; controller/setConnection are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-page text-frost">
      <DeskHeader onOpenAudit={() => setAuditOpen(true)} />
      <StatsBar />

      <div className="grid flex-1 grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)]">
        {/* centerpiece */}
        <section
          aria-label="Surveillance pipeline topology"
          className="min-h-[560px]"
        >
          <TopologyGraph />
        </section>

        {/* right rail — HITL surfaces only when the case is ESCALATED */}
        <aside className="flex min-w-0 flex-col gap-4 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto">
          <HITLControls />
          <DossierCards />
          <VerdictTimeline />
          <RuleRegistryPanel />
        </aside>
      </div>

      <AuditDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        audit={getAuditView(model.case.id)}
      />
    </main>
  );
}
