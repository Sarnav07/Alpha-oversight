import type { Metadata } from "next";
import { DeskShowcaseHeader } from "@/components/desk/showcase/DeskShowcaseHeader";
import { DeskShowcaseHero } from "@/components/desk/showcase/DeskShowcaseHero";
import { LiveCommandCenter } from "@/components/desk/LiveCommandCenter";

/**
 * /desk - the Live Command Center showcase + the real demo.
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
    "Watch the system think - live. Every agent action streams over Band, every verdict is deterministic and hash-chained. Scroll through how the desk is wired, then run the real Beat-B demo.",
};



export default function DeskPage() {
  return (
    <div data-section="light" className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}>
      <DeskShowcaseHeader />
      <main>
        <DeskShowcaseHero />
        <LiveCommandCenter />
      </main>
    </div>
  );
}
