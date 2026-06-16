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

---

## P0 — Redesign the Command Center (`/desk`)  ← user priority
The current desk look is **rejected** ("looks shitty") and will be replaced. The
data layer (`lib/desk/`, `components/desk/` model wiring) is sound — rebuild the
*presentation*, keep the contracts.
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
`npx tsc --noEmit` (clean) → `npm run build` (exit 0) → serve + screenshot the
changed surface. Match the report's facts; never fabricate stats. See `CLAUDE.md`
§"System facts" and §"Verification without a browser".
