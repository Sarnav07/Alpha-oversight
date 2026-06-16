"use client";

import Preloader from "@/components/landing/Preloader";
import HeroScroll from "@/components/landing/HeroScroll";
import KeyFigures from "@/components/landing/KeyFigures";
import ManifestoSection from "@/components/landing/ManifestoSection";
import FeaturesCarousel from "@/components/landing/FeaturesCarousel";
import UnlockSection from "@/components/landing/UnlockSection";
import OverviewSection from "@/components/landing/OverviewSection";
import AuditChainSection from "@/components/landing/AuditChainSection";

/**
 * Public landing page — first-scroll experience.
 *
 * A black <Preloader/> splash plays once per session, then the page reveals the
 * pinned "device-zoom" hero (<HeroScroll/>, which itself mounts <LandingNav/>
 * and composes <CommandCenterArt/> across the four reference frames), handing
 * off to the closing <KeyFigures/> stats band.
 *
 * The live data-loop Command Center lives at /desk and is untouched.
 */
export default function LandingPage() {
  return (
    <>
      <Preloader />
      <main>
        <HeroScroll />
        <OverviewSection />
        <KeyFigures />
        <ManifestoSection />
        <FeaturesCarousel />
        <AuditChainSection />
        <UnlockSection />
      </main>
    </>
  );
}
