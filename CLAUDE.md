@AGENTS.md

# Alpha & Oversight — Frontend (CLAUDE.md)

The public landing page + live trace viewer for **Alpha & Oversight** (lablab.ai
*Band of Agents* hackathon). Clones the **AlphaLedger** fintech visual identity,
themed for adversarial trade-surveillance. The global `~/CLAUDE.md` workflow
rules and the imported `AGENTS.md` Next.js rule apply on top.

> **READ FIRST (from AGENTS.md):** this is **Next.js 16.2.9** — APIs and
> conventions differ from training data. Consult `node_modules/next/dist/docs/`
> before writing framework code. Heed deprecation notices.

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
npm run build    # next build  (run this before `start` — `start` serves the last build)
npm run start    # next start -p 4100
npm run lint     # eslint
npx tsc --noEmit # AUTHORITATIVE type check — run after every edit
```

## Verification without a browser (this environment can't screenshot live pages)
This is the established loop — use it before claiming any UI work is done:
1. `npx tsc --noEmit` — authoritative; must be clean.
2. `npm run build` — must be exit 0 (rebuild before `next start`, which serves
   the *last* build — stale markers = you forgot to rebuild).
3. `next start` + `curl --retry --retry-connrefused http://localhost:4100` to
   confirm HTTP 200 + grep section markers. The sandbox kills long-running
   servers — run the server with `dangerouslyDisableSandbox`.
4. For static layout/SVG proportions, render the component to PDF via
   **weasyprint** and Read the PDF. **Caveat:** weasyprint does NOT support 3D
   transforms or box-shadow — judgment calls on tilt/perspective/animation need
   the user's eyeball; flag them honestly, don't claim they're verified.

## Design language (match the AlphaLedger reference EXACTLY)
Monochrome backbone; **accents are semantic ONLY** (see `app/globals.css`
"DESIGN TOKENS"). Reference assets the user compares against live at
`band_agents/frontend-design/` (numbered PNGs, `*-fucked.png` = my hallucinated
version, `.mov` walkthroughs) + `band_agents/FRONTEND_SPEC.md` and
`FRONTEND_BUILD_PLAN.md` in the sibling backend repo.
- Obsidian `#020202` / frost `#fefefe`; hard light↔dark section cuts; eyebrow
  labels; two-tone headings (ink + faint gray); the angular AlphaLedger
  `Logomark`.
- **`--band-blue #3b82f6` is sacred** — it means "waiting on Band" and nothing
  else. Verdict colors: pass/flag/escalate/complete. Desk tones (rnd/surv) are
  tone-only.
- ⚠️ **Token gotcha:** `[data-section="light"]` remaps tokens to the white
  theme. A **fixed/position element NOT nested inside `data-section="light"`
  resolves tokens to ROOT (dark) values** — this caused the invisible navbar.
  Use explicit hex (`#14161c`) on light frames, or the deterministic scroll-spy
  in `LandingNav.tsx`.

## Layout (`app/` + `components/landing/`)
- `app/page.tsx` — landing composition: `<Preloader/>` then `<main>` with
  `<HeroScroll/> <KeyFigures/> <ManifestoSection/> <FeaturesCarousel/>
  <UnlockSection/>`.
- `app/desk/page.tsx` — the live trace viewer (Phase 6 target).
- `components/landing/` — `Preloader` (black splash, once/session) ·
  `HeroScroll` (GSAP pinned device-zoom, "dive into screen") · `LandingNav`
  (deterministic luminance scroll-spy, not mix-blend) · `KeyFigures` (count-up
  stats) · `ManifestoSection` (word-by-word scroll fill) · `FeaturesCarousel`
  (pinned horizontal, white bg) · `UnlockSection` (closing CTA, shield emblem) ·
  `Logomark` (shared SVG mark) · `art/` (dashboard art components).
- `lib/` — `api/client`, `eventsource/` (SSE adapter + marker parser), `store/`
  (zustand trace store), `fixtures/`, `config`, `types`. These wire to the
  backend contracts: `/stream` SSE (desk) · `/cases` · `/cases/{id}/audit` ·
  `/rules` · `/stats`.

## Conventions / hard-won lessons
- **Match the reference pixel-for-pixel** (size, spacing, alignment, color,
  structure). The user repeatedly caught hallucinated drift via `-fucked.png`
  comparisons — when in doubt, extract frames from the `.mov` and compare, don't
  invent.
- Every animated component needs a **`useReducedMotion` fallback** (final state
  rendered immediately).
- framer-motion `ease` cubic-beziers must be typed as a 4-tuple:
  `[0.16, 1, 0.3, 1] as [number, number, number, number]` (a bare array widens
  to `number[]` and fails tsc).
- `frontend-design/` and the mockups stay **local — never pushed**.

## Git / push (security — non-negotiable)
- Remote: `https://github.com/Sarnav07/Alpha-oversight.git`.
- **Never** add `Co-Authored-By: Claude` to commits. **No** stored git creds on
  the VM. Push only via an **ephemeral authenticated URL** (token never written
  to `.git/config`); scrub and verify nothing persists after each push. Tokens
  pasted in chat are exposed in the transcript — remind the user to revoke them.
