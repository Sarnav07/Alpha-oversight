"use client";

import Preloader from "@/components/landing/Preloader";
import HeroScroll from "@/components/landing/HeroScroll";
import KeyFigures from "@/components/landing/KeyFigures";
import ManifestoSection from "@/components/landing/ManifestoSection";
import FeaturesCarousel from "@/components/landing/FeaturesCarousel";
import WhySection from "@/components/landing/WhySection";
import UnlockSection from "@/components/landing/UnlockSection";
import OverviewSection from "@/components/landing/OverviewSection";
import AuditChainSection from "@/components/landing/AuditChainSection";
import PoweredBySection from "@/components/landing/PoweredBySection";
import MoreAboutSection from "@/components/landing/MoreAboutSection";
import FaqSection from "@/components/landing/FaqSection";
import StayAheadSection from "@/components/landing/StayAheadSection";
import ContactSection from "@/components/landing/ContactSection";
import SiteFooter from "@/components/landing/SiteFooter";

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
        <KeyFigures />
        <ManifestoSection />
        <FeaturesCarousel />
        <UnlockSection />
        <OverviewSection />
        <AuditChainSection />
        <PoweredBySection />
        <WhySection />
        <MoreAboutSection />
        <FaqSection />
        <StayAheadSection />
        <ContactSection />
        <SiteFooter />
      </main>
    </>
  );
}
