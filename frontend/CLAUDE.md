@AGENTS.md

# Alpha & Oversight - Frontend (CLAUDE.md)

The public landing page + live trace viewer for **Alpha & Oversight** (lablab.ai
*Band of Agents* hackathon). Clones the **AlphaLedger** fintech visual identity,
themed for adversarial trade-surveillance. The global `~/CLAUDE.md` workflow
rules and the imported `AGENTS.md` Next.js rule apply on top.

> **READ FIRST (from AGENTS.md):** this is **Next.js 16.2.9** - APIs and
> conventions differ from training data. Consult `node_modules/next/dist/docs/`
> before writing framework code. Heed deprecation notices.

## System facts - SOURCE OF TRUTH: `band_agents/frontend-design/Report_band_agents.pdf`
Every on-screen claim MUST match these (the report was generated from the real
backend+frontend source). Earlier drift - "14 agents", "all Surveillance =
frontier", fabricated `847 alerts / 72% FP / <3s` stats - was hallucination.
- **8 LLM agents + 1 deterministic rule engine.** The rule engine is NOT an
  agent - it is plain code and the *sole* PASS/FLAG authority.
- **Two desks, one Chinese wall.** R&D = 1 agent (**Adversary**). Surveillance =
  7 (**Anomaly Detector, Investigator, Specialist, Prosecution, Defense,
  Adjudicator, Escalation Manager**).
- **Model tiers (2) - mixed, not by desk.** FRONTIER = **Prosecution**
  (`claude-sonnet-4-6`) + **Escalation Manager** (`gpt-5-mini`). OPEN = everyone
  else (Qwen3-Next-80B; Defense = Qwen3.6-35B). ⚠️ Never call the whole
  Surveillance desk "frontier."
- **Band = transport-of-record** (NOT a notification). 5 kinds:
  `HANDOFF · EVIDENCE · VERDICT · ESCALATION · RULE_CODIFIED`. The
  Prosecution⚔Defense debate runs **locally**, not over Band.
- **Chinese wall = `SanitizedBridge`:** only raw order events cross R&D→Surv;
  reasoning + model identity stripped. The rulebook is the only thing flowing
  back (read-only to R&D).
- **LLMs argue; code decides.** Agents only set contested inputs (time window,
  bona-fide orders, intent); the engine renders PASS/FLAG. No LLM overrules it.
- **4 seed rules:** layering + spoofing (FINRA 5210), wash + marking (SEC 10b-5).
  Thresholds: spoofing `cancel_ratio ≥ 0.8` · layering `depth_levels ≥ 3` · wash
  `self_match_ratio > 0.5` · marking `eod_print_move_bps ≥ 100`.
- **Beat A** = known trick → engine FLAGs → `FLAGGED`. **Beat B** = novel evasion
  → engine PASS → `ESCALATED` → human confirms → derive + regression-gate +
  codify (rules **4 → 5**, emit `RULE_CODIFIED`) → `FLAGGED`.
- **5 case states:** OPEN · UNDER_REVIEW · FLAGGED · ESCALATED · CLOSED (every
  non-final state times out → CLOSED, so a case never hangs).
- **Audit:** hash-chained ledger; each leaf = one Band message (sha256 +
  `band_message_id`); `verify_chain()` recomputes live.
- **Endpoints:** `/stream` (SSE) · `/cases` · `/cases/{id}` · `/cases/{id}/audit`
  · `/rules` · `/stats` · `POST /cases/{id}/confirm|reject` ·
  `POST /demo/beat-a|beat-b|rnd`.
- **NEVER fabricate** alert counts, FP %, analyst-hours, latency SLAs, or test
  counts as marketing. Stats come from `model.stats` (`/stats`) or are
  system-true facts (8 agents, 4 seed rules, 100% deterministic verdicts).

## Stack
- **Next.js 16.2.9** (App Router) · **React 19.2.4** · **TypeScript** ·
  **Tailwind v4** (CSS-first `@theme`, tokens in `app/globals.css`).
- **framer-motion ^12** (useScroll/useInView/useTransform/useReducedMotion) for
  scroll reveals & count-ups · **gsap ^3.15 + ScrollTrigger** for the pinned
  device-zoom hero · **@xyflow/react** for the topology graph (Phase 6 viewer) ·
  recharts · zustand · @tanstack/react-query.

## Commands (dev server runs on port **4100**)
```bash
npm run dev      # next dev -p 4100
npm run build    # next build  (run this before `start` - `start` serves the last build)
npm run start    # next start -p 4100
npm run lint     # eslint
npx tsc --noEmit # AUTHORITATIVE type check - run after every edit
```

## Verification without a browser (this environment can't screenshot live pages)
This is the established loop - use it before claiming any UI work is done:
1. `npx tsc --noEmit` - authoritative; must be clean.
2. `npm run build` - must be exit 0 (rebuild before `next start`, which serves
   the *last* build - stale markers = you forgot to rebuild).
3. `next start` + `curl --retry --retry-connrefused http://localhost:4100` to
   confirm HTTP 200 + grep section markers. The sandbox kills long-running
   servers - run the server with `dangerouslyDisableSandbox`.
4. For static layout/SVG proportions, render the component to PDF via
   **weasyprint** and Read the PDF. **Caveat:** weasyprint does NOT support 3D
   transforms or box-shadow - judgment calls on tilt/perspective/animation need
   the user's eyeball; flag them honestly, don't claim they're verified.

## Design language (match the AlphaLedger reference EXACTLY)
Monochrome backbone; **accents are semantic ONLY** (see `app/globals.css`
"DESIGN TOKENS"). Reference assets the user compares against live at
`band_agents/frontend-design/` (numbered PNGs - `*-correct.png` = the AlphaLedger
target, `*-fucked.png` = my hallucinated version - `.mov` walkthroughs, and
**`Report_band_agents.pdf`** = the authoritative product spec) + the sibling
backend repo's `FRONTEND_SPEC.md` / `FRONTEND_BUILD_PLAN.md`.
- Obsidian `#020202` / frost `#fefefe`; hard light↔dark section cuts; eyebrow
  labels; two-tone headings (ink + faint gray); the angular AlphaLedger
  `Logomark`.
- **`--band-blue #3b82f6` is sacred** - it means "waiting on Band" and nothing
  else. Verdict colors: pass/flag/escalate/complete. Desk tones (rnd/surv) are
  tone-only.
- ⚠️ **Token gotcha:** `[data-section="light"]` remaps tokens to the white
  theme. A **fixed/position element NOT nested inside `data-section="light"`
  resolves tokens to ROOT (dark) values** - this caused the invisible navbar.
  Use explicit hex (`#14161c`) on light frames, or the deterministic scroll-spy
  in `LandingNav.tsx`. **Inverse case:** a *dark* panel nested inside a
  `data-section="light"` page (e.g. the how-it-works story stage) inherits the
  light inks → frost text renders near-black. Fix: tag it `data-section="dark"`
  (a reset block now exists in `globals.css` mirroring the root dark tokens).

## Layout (`app/` + `components/`)
- `app/page.tsx` - landing composition (current order): `<Preloader/>` then
  `<HeroScroll/> <KeyFigures/> <ManifestoSection/> <FeaturesCarousel/>
  <UnlockSection/> <OverviewSection/> <AuditChainSection/> <PoweredBySection/>
  <WhySection/> <MoreAboutSection/> <FaqSection/> <StayAheadSection/>
  <ContactSection/> <SiteFooter/>`.
- `app/how-it-works/page.tsx` - the "The Evasion" scroll-story. `EvasionStory`
  is a **split layout** (narrative-left / live-graph-right, pinned scrub through
  6 beats; `data-section="dark"` stage); copy/numbers track the report PDF
  (manipulation line `τ 0.80`, 100→450ms window, rules 4→5). `StorySections`
  carries the two-desks + seed-rule + rule-engine sections.
- `app/desk/page.tsx` - the live Command Center (SSE trace viewer). ⚠️ **Slated
  for a full redesign** - the current look is rejected; do NOT over-invest in its
  visuals, it will be replaced. The data layer (`lib/desk/`) is fine to build on.
- `components/landing/` - `Preloader` · `HeroScroll` · `LandingNav`
  (deterministic luminance scroll-spy) · `KeyFigures` (system-fact count-ups) ·
  `ManifestoSection` · `FeaturesCarousel` (pinned, landscape cards, laptop bleed)
  · `UnlockSection` + shared `ShieldEmblem` (centred frosted badge) ·
  `OverviewSection` (Band nonagon) · `AuditChainSection` (hash-chain staircase) ·
  `PoweredBySection` (why-different panel) · `Logomark` · `art/`.
- `components/desk/` (Command Center) + `components/how-it-works/` (+ `evasion/`).
- `lib/` - `api/client`, `eventsource/` (SSE adapter + marker parser),
  `desk/` (model/nodes/contract), `fixtures/`, `config`, `types`. Wire to the
  backend contracts in **System facts** above.

## Conventions / hard-won lessons
- **Match the reference pixel-for-pixel** (size, spacing, alignment, color,
  structure). The user repeatedly caught hallucinated drift via `-fucked.png`
  comparisons - when in doubt, extract frames from the `.mov` and compare, don't
  invent.
- Every animated component needs a **`useReducedMotion` fallback** (final state
  rendered immediately).
- framer-motion `ease` cubic-beziers must be typed as a 4-tuple:
  `[0.16, 1, 0.3, 1] as [number, number, number, number]` (a bare array widens
  to `number[]` and fails tsc).
- `frontend-design/` and the mockups stay **local - never pushed**.

## Git / push (security - non-negotiable)
- Remote: `https://github.com/Sarnav07/Alpha-oversight.git`.
- **Never** add `Co-Authored-By: Claude` to commits. **No** stored git creds on
  the VM. Push only via an **ephemeral authenticated URL** (token never written
  to `.git/config`); scrub and verify nothing persists after each push. Tokens
  pasted in chat are exposed in the transcript - remind the user to revoke them.
