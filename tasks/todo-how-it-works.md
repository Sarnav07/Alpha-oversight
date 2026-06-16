# Plan — Landing nav fix + /how-it-works + overview/audit

**Approved 2026-06-16.** Fixes the 3 dead nav anchors and builds new animated surfaces.
Holds the A&O identity (monochrome backbone + semantic accents) — NOT the OmniCurve
reference's red/cream skin. Tokens/keyframes already in `app/globals.css`.

## Decisions
- **How it works** = dedicated route `/how-it-works`, pinned scroll-story "The Evasion"
  (6 chapters, morphing order-lane + rule-window stage, telling the codify 4→5 story).
  LIGHT editorial page (`data-section="light"`), DARK stage panel (`var(--bg-inset)`,
  not remapped by the light block) so semantic accents glow.
- **#overview** + **#audit** = two new animated landing sections (real ids).
- **Font** = PARKED. No Aeonik files exist anywhere (checked repo/Downloads/home/design).
  Keep Geist; wire `next/font/local` only once user drops `Aeonik-*.woff2` in `app/fonts/`.
- **/desk visual pass** = deferred (user's call, later).

## Shared seam (lead-frozen BEFORE team — done)
- `components/anim/Reveal.tsx` — reveal-on-scroll (fade+rise, once), reduced-motion safe.
- `components/anim/MaskLines.tsx` — editorial line-mask staggered reveal, reduced-motion safe.
- Sticky offset constant: header `h-14 sticky top-0`; story stage `sticky top-14
  h-[calc(100vh-3.5rem)]`.

## Team (disjoint owners)
### A1 — "The Evasion" pinned story (centerpiece)
`components/how-it-works/EvasionStory.tsx` + `evasion/{stage.ts geometry, Caption, Hud, PhaseRail}`.
6 chapters via useScroll+useSpring(t)+useTransform over one SVG stage. Exports `EvasionStory`.

### A2 — how-it-works editorial chrome
`components/how-it-works/{HowItWorksHeader, HowItWorksHero, StorySections, ClosingCTA}.tsx`.
Header (logomark + back + Live Desk), hero (self-drawing motif + scroll cue), below-story
reveal sections (two desks R&D⚔Surveillance, 4 detectors + cited metrics), CTA → /desk.

### B — #overview section
`components/landing/OverviewSection.tsx` — self-drawing two-desk + Band co-evolution loop
(pathLength on whileInView). `id="overview"`. Default export.

### C — #audit section
`components/landing/AuditChainSection.tsx` — tamper-evident hash-chain (blocks link on
scroll, verify_chain ✓ stamp). `id="audit"`. May read `art/AuditChainArt.tsx` (ref only).

## Lead integrates + verifies
- `app/how-it-works/page.tsx` — thin composition of A1+A2 (wrap in `data-section="light"`).
- `components/landing/LandingNav.tsx` — How it works → `/how-it-works` (isRoute), anchors now resolve.
- `app/page.tsx` — insert OverviewSection (after Hero) + AuditChainSection (before Unlock).
- Verify: tsc + build exit 0; curl `/` and `/how-it-works` → 200 + new id/marker grep; weasyprint static layout.

## Review (2026-06-16 — DONE)

**Outcome:** Dead nav anchors fixed + new animated surfaces shipped, built by a 4-teammate
team against the frozen `components/anim` seam. Verified: `npx tsc --noEmit` exit 0 ·
`npm run build` exit 0 (4 routes prerendered incl. `/how-it-works`) · prod server (port 4101)
→ `/`, `/how-it-works`, `/desk` all HTTP 200, no runtime errors · marker grep on `/`
confirms `id="overview"`, `id="audit"`, "verify_chain", "adversarial loop", and nav now
emits `href="/how-it-works"`; `/how-it-works` SSR carries all 6 chapters (waiting on Band,
window_ms, ESCALATE, codify, Prosecution/Defense, "Watch it live").

**Files:**
- Lead (frozen first): `components/anim/{Reveal,MaskLines}.tsx`.
- Evasion: `components/how-it-works/EvasionStory.tsx` + `evasion/{stage.ts,Caption,Hud,PhaseRail}.tsx`.
- Editorial: `components/how-it-works/{HowItWorksHeader,HowItWorksHero,StorySections,ClosingCTA}.tsx`.
- Overview: `components/landing/OverviewSection.tsx` (#overview).
- AuditChain: `components/landing/AuditChainSection.tsx` (#audit).
- Integration (lead): `app/how-it-works/page.tsx` (light editorial wrap); `LandingNav.tsx`
  (How it works → `/how-it-works` route); `app/page.tsx` (Overview after Hero, Audit before Unlock).

**NOT verified here (needs your browser — env can't screenshot live motion):** the scroll-story
morph (cluster vs window, codify 4▸5), the band-blue waiting pulse, the self-drawing overview
loop, the hash-chain draw + verify ✓ + tamper toggle. A dev server is already running on :4100
(yours) — open http://localhost:4100/how-it-works and scroll.

**PARKED:** Aeonik font swap — no `.woff2` files exist anywhere (checked repo/Downloads/home/
design). Drop `Aeonik-*.woff2` into `frontend/app/fonts/` and I'll wire `next/font/local`
(one edit to `app/layout.tsx`). `/desk` visual pass still deferred (your call).
