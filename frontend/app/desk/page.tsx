import type { Metadata } from "next";
import { DeskShowcaseHeader } from "@/components/desk/showcase/DeskShowcaseHeader";
import { DeskShowcaseHero } from "@/components/desk/showcase/DeskShowcaseHero";
import { ServerSurface } from "@/components/desk/showcase/ServerSurface";
import { DataFlow } from "@/components/desk/showcase/DataFlow";
import { HighImpact } from "@/components/desk/showcase/HighImpact";
import { RunningItLive } from "@/components/desk/showcase/RunningItLive";
import { LiveCommandCenter } from "@/components/desk/LiveCommandCenter";

/**
 * /desk — the Live Command Center showcase + the real demo.
 *
 * A landing/how-it-works-style scroll-story on the dark Command-Center backbone
 * (root tokens → frost on obsidian, no data-section wrap), sourced from
 * Report_band_agents.pdf: pinned hero → the server surface (§10) → the data flow
 * (§12·D12, pinned scrub) → interactive high-impact features (§13) → running it
 * live (§14·D13) → and the ACTUAL functional <LiveCommandCenter/> (§9) where the
 * real Beat-B demo runs (mock out-of-box; NEXT_PUBLIC_DATA_MODE=live for live).
 */
export const metadata: Metadata = {
  title: "Live Command Center · Alpha & Oversight",
  description:
    "Watch the system think — live. Every agent action streams over Band, every verdict is deterministic and hash-chained. Scroll through how the desk is wired, then run the real Beat-B demo.",
};

/** A centred handoff into the functional desk. */
function DeskHandoff() {
  return (
    <section
      className="relative mx-auto px-6 pb-16 pt-8 text-center"
      style={{ maxWidth: "var(--maxw-content)", color: "var(--text-primary)" }}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--desk-surv)" }}>
        ▼ The live desk
      </span>
      <h2
        className="mx-auto mt-4 max-w-2xl font-sans"
        style={{ fontSize: "clamp(24px,3.4vw,38px)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1 }}
      >
        <span style={{ color: "var(--text-primary)" }}>The real thing.</span>{" "}
        <span style={{ color: "var(--text-faint)" }}>A novel evasion is already waiting on your Confirm.</span>
      </h2>
      <p className="mx-auto mt-5 max-w-xl font-sans" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
        Beat B runs out of the box: the rules miss it, the case escalates. Confirm
        it and watch the rulebook grow 4 ▸ 5 — then open the audit drawer and
        verify the chain.
      </p>
    </section>
  );
}

export default function DeskPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}>
      <DeskShowcaseHeader />
      <main>
        <DeskShowcaseHero />
        <ServerSurface />
        <DataFlow />
        <HighImpact />
        <RunningItLive />
        <DeskHandoff />
        <LiveCommandCenter />
      </main>
    </div>
  );
}
