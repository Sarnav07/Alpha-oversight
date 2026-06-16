import type { Metadata } from "next";
import { HowItWorksHeader } from "@/components/how-it-works/HowItWorksHeader";
import { HowItWorksHero } from "@/components/how-it-works/HowItWorksHero";
import { EvasionStory } from "@/components/how-it-works/EvasionStory";
import { StorySections } from "@/components/how-it-works/StorySections";
import { ClosingCTA } from "@/components/how-it-works/ClosingCTA";

/**
 * /how-it-works — "The Evasion" pinned scroll-story.
 *
 * Walks the surveillance lifecycle on one morphing order-lane stage: a novel
 * 400ms layering evasion slips the 100ms seed rule (PASS → escalate), a human
 * confirms, and the rule engine codifies a wider window (Active Rules 4 ▸ 5) so
 * the evasion can never evade again.
 *
 * LIGHT editorial frame (`data-section="light"` remaps chrome tokens to the white
 * theme); the EvasionStory's stage panel uses `--bg-inset` (NOT remapped) so it
 * stays dark and the semantic accents glow. Server component — children own their
 * own "use client" + scroll hooks.
 */
export const metadata: Metadata = {
  title: "How it works · Alpha & Oversight",
  description:
    "The adversary invents, the system learns. Watch a novel 400ms layering evasion slip the seed rule, escalate to a human, and get codified into a new rule — live, deterministic, hash-chained.",
};

export default function HowItWorksPage() {
  return (
    <div
      data-section="light"
      className="min-h-screen bg-page text-[color:var(--text-primary)]"
    >
      <HowItWorksHeader />
      <main>
        <HowItWorksHero />
        <EvasionStory />
        <StorySections />
        <ClosingCTA />
      </main>
    </div>
  );
}
