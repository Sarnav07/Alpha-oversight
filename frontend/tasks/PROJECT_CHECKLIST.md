# Alpha & Oversight — Project Checklist

Derived from **`band_agents/frontend-design/Report_band_agents.pdf`** (the
authoritative spec, generated from the real source) + this session's decisions.
Work top-down; each box is one self-contained step. Frontend-focused (this repo),
with backend/ops items flagged.

> Status snapshot (per report §15): the **backend is done** (8 agents + rule
> engine, Band mock+real, wall+bridge, hash-chain+verify, Act I & II, live codify
> + regression, full server + SSE). The **frontend is ~95%** (landing + Command
> Center + data layer; mock mode works today). What remains is polish, 3 wiring
> stubs, going live, and deploy — plus the desk redesign we've decided on.
>
> **Update 2026-06-17:** the `/desk` **data layer is built & live-verified**
> (wired to live SSE/REST, E2E green, error/recovery states, AuditDrawer a11y,
> 65 vitest + ledger concurrency test). Only the desk **visuals** are deferred to
> the redesign (P0 below). See `VERIFICATION_GUIDE.md`.

---

## ✅ Recently done (this session — don't redo)
- [x] Landing factual audit vs backend — fixed agent tiers (only Prosecution +
      Escalation = frontier), removed fabricated stats (847/72%/41.2h/197/<3s),
      fixed Adversary→Prosecution debate bug, real `/stats` on the desk StatsBar.
- [x] How-it-works "The Evasion" — **split layout** redesign (narrative-left /
      graph-right), mustard→red/green/blue recolor, legible step rail, agent
      labels, copy + numbers aligned to the report (`τ 0.80`, 100→450ms, 4→5).
- [x] `[data-section="dark"]` reset added to `globals.css` (dark panels inside
      light pages now render frost text).
- [x] `CLAUDE.md` updated with the **System facts** block (source of truth).

### ✅ Done 2026-06-17 (verified: tsc clean · build exit 0 · vitest 65/65 · pytest 12/12)
Landing / how-it-works copy + a11y + data-layer hardening. See `VERIFICATION_GUIDE.md`.
- [x] **Removed the fabricated `94%` stat** — `WhySection` first stat card now
      reads `0` / "LLMs decide the verdict" (the thesis: LLMs argue, code decides).
- [x] **Hero story rotation** — `HeroScroll` headline is now a 2-line story:
      "Your adversary" + a rotating clause cycling "catches the evasion." /
      "invents the attack." / "codifies the rule." (Beat-A / R&D / Beat-B).
- [x] **`& OVERSIGHT` wordmark → full frost** in `Preloader` (was dim gray; now
      matches "ALPHA").
- [x] **Overview nonagon hub → a single `BAND` wordmark** (band-blue, aria-hidden)
      replacing the 3 stacked center lines; added a footnote "9 roles = 8 agents +
      the rule engine; the human confirms" and the `PoweredBySection` badge now
      reads "8 agents · 1 rule engine · 2 tiers".
- [x] **KeyFigures middle tile → static `4 → 5`** (was a count-up to 4); labels
      bumped to ~13px / 0.08em.
- [x] **Defense model id de-truncated** — `AgentRoster` now reads
      `Qwen3.6-35B-A3B` (was `Qwen3.6-35B`).
- [x] **RuleRegistryPanel header de-hardcoded** — `{rules.length-1} → {rules.length}`
      (was hardcoded "4 → 5"; now updates to "5 → 6" once a 5th rule codifies).
- [x] **SSE error state made visible (live)** — `LiveSSEAdapter` escalates to a
      real "error" connection state on persistent failure (≥3 onerror / CLOSED /
      6s dead-on-connect) instead of perpetual "reconnecting"; new `ErrorBanner`
      ("Backend unreachable — retrying…"), `ConnectionStatus` red "backend down"
      pill, and `StatsBar` "—"/"unavailable" on failed `/stats`|`/rules`.
- [x] **Single `/stream` EventSource across beats** — `useTraceStore.connect()`
      `if (adapter) return` no-op guard (no per-beat abort+reopen).
- [x] **Codify refetch debounced ~500ms** in `useInvalidateOnMarkers` so Active
      Rules animates 4→5 cleanly (no 5→4→5 flicker).
- [x] **Confirm/Reject rollback + error mapping** — `HITLControls` awaits the
      action, flips to success only on a real 2xx, and shows an inline red
      `role="alert"` reason on failure (422 gate-failed / 409 not-escalated /
      404 not-found); `controller.ts` rethrows a `DeskActionError` with `.status`.
- [x] **AuditDrawer a11y** — `aria-modal`, hand-rolled focus trap (Tab cycles in,
      focus restored on close), Escape-to-close, and an `isLoading` spinner before
      the fixture fallback (no more C-0187 flash).
- [x] **CoEvolutionLadder honours `useReducedMotion`** (rungs appear instantly
      when OS reduce-motion is on).
- [x] **`parseMarker` DEV-only drift warning** + **full vitest suite (65 tests /
      5 suites: parseMarker 31, useTraceStore, LiveSSEAdapter, useDeskModel,
      HITLControls)** — run `npm run test`.
- [x] **Ledger concurrency fix** — `backend/.../audit/ledger.py` `append()` is
      `threading.Lock`-guarded and chains off the live in-memory `_head` (no
      forked `prev_hash`); `test_ledger.py` adds a 4×25 interleaved-append test
      (`verify_chain` True). `pytest backend/tests/test_ledger.py` → 12 passed.
- [x] **`WORKING STUB` headers stripped** from `model.ts` / `controller.ts`;
      `model.ts` exposes `statsError`/`rulesError`; lazy gsap imports moved off
      the critical bundle (`HeroScroll`/`FeaturesCarousel`/`PoweredBySection`);
      satirical cookie card marked `inert`; topology `<text>` nodes aria-hidden;
      `LiveCommandCenter` shows a "Click a demo to begin." hint when idle.

---

## P0 — Redesign the Command Center (`/desk`)  — **DEFERRED (visuals only)**
**Data layer is DONE & live-verified (2026-06-17)** — the desk is built, wired to
live SSE/REST, E2E green; only the **presentation** is deferred. The current desk
look is **rejected** ("looks shitty") and will be replaced. The data layer
(`lib/desk/`, `components/desk/` model wiring) is sound — rebuild the
*presentation*, keep the contracts. The boxes below track the **visual** rebuild.
- [ ] Agree a new visual direction for the desk (reference the report §11 panel
      list + §13 "aesthetic edge"; bring screenshots to compare).
- [ ] Rebuild the **topology graph** panel (R&D left · wall · Surveillance right;
      nodes light up on activity; the sacred blue "waiting on Band" pulse).
- [ ] Rebuild the **verdict timeline**, **dossier cards** (frontier/open badges),
      **rule registry** (4 seed → 5th slides in on confirm), **human
      confirm/reject** controls, **audit drawer** (live `verify_chain` ✓), and
      **stats bar + connection pill**.
- [ ] Keep the discipline: blue = Band only; colour always means something;
      `useReducedMotion` fallbacks.

## P1 — Wire the 3 UI stubs (report §12.5 / §15 "Left")
- [ ] **Live R&D stream:** `runRnD` should open an SSE to `POST /demo/rnd` and
      render the adversary's rounds live (currently replays a fixture).
- [ ] **SearchBar** on the topology — filter/isolate nodes.
- [ ] **FilterChips** on the topology — filter by desk / case state.

## P2 — High-impact demo additions (report §13, by effort)
- [ ] (low) **Band-envelope tooltip on edges** — hover an edge → real envelope
      (kind, from→to, sha256, message id). Drives home "Band is the record."
- [ ] (med) **Tamper-test toggle** — flip a byte in the audit drawer, watch
      `verified` go ✓→✗ live.
- [ ] (high) **Co-evolution ladder** — visualise attacker-vs-defender rounds
      climbing over time (the headline narrative in one image).

## P3 — Go live (report §12 go-live checklist)
- [ ] Start backend on `:8000` (`make run-backend`); set LLM + Band keys, or
      leave `USE_REAL_BAND=false` for the keyless fixture run.
- [ ] Frontend `.env.local`: `NEXT_PUBLIC_DATA_MODE=live` +
      `NEXT_PUBLIC_API_BASE=http://localhost:8000`.
- [ ] Trigger a beat (`/demo/beat-a` · `/beat-b`) from the header; confirm
      topology, timeline, rules, and audit update live.

## P4 — Deploy (report §15 "Left")
- [ ] Host the viewer + a replay backend (recorded fixtures) so the demo never
      depends on a live model finishing in time.

---

## Housekeeping (this session, outside the report)
- [ ] **Combine repos** into `Sarnav07/Alpha-oversight` with the backend under
      `backend/` via `git subtree` — rewrite the imported commits' author to the
      teammate's GitHub noreply (`155217152+PrathamSingla15@users.noreply.github.com`)
      so GitHub auto-credits them as a contributor. (Both repos are public.)
- [ ] **Revoke exposed GitHub tokens** pasted in chat (the latest `ghp_sWVr…` and
      the four earlier ones) at https://github.com/settings/tokens.

---

### Verification loop (run before claiming any item done)
`npx tsc --noEmit` (clean) → `npm run build` (exit 0) → `npm run test` (vitest
65/65) → `pytest backend/tests/test_ledger.py` (for ledger changes) → serve +
screenshot the changed surface. Match the report's facts; never fabricate stats.
See `VERIFICATION_GUIDE.md` for the full 2026-06-17 verification evidence, plus
`CLAUDE.md` §"System facts" and §"Verification without a browser".
