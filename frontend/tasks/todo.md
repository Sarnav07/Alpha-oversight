# Plan — `/desk` Command Center (mock mode)

> ✅ COMPLETED 2026-06-16 (mock Command Center built). Superseded — see FRONTEND_IMPROVEMENTS.md (STATUS: COMPLETE) + VERIFICATION_GUIDE.md.

**Decisions locked (2026-06-16):** build the whole `/desk` against the MOCK adapter
now (fixtures, no backend); integrate live backend later when the frontend is done.
One case at a time / replay-driven (sidesteps missing `case_id`). Backend edits
authorized but NOT needed this phase. Execution: agent team (disjoint file owners).

Reference: `tasks/CONTEXT.md` (full synthesized brief). Tokens/keyframes already in
`app/globals.css`. Data seam already exists: `lib/eventsource/adapter.ts` (MockAdapter
replays a fixture at 900ms) → `lib/store/useTraceStore.ts` (events/latestByAgent) →
components subscribe. parseMarker maps `content` strings → `Marker.stage`.

## The screen (single-screen dark Command Center, `app/desk/page.tsx`)
```
┌ Header: logomark · ConnectionStatus · ReplayBanner · DemoControls(Beat A / Beat B / R&D) ┐
├ StatsBar:  Active Rules(4→5) · Flagged · Escalated · [847 alerts · 72% FP · 41.2h] ──────┤
├ TopologyGraph (CENTERPIECE, @xyflow/react)            │  VerdictTimeline (dots) ──────────┤
│  R&D ▸ Bridge(wall) ▸ Anomaly ▸ Investigator(BLUE     │  DossierCards (Prosecution⚔Defense)│
│  waiting-on-Band pulse) ▸ Specialist ▸ Pros/Def ▸     │  RuleRegistryPanel (4→5 reveal)    │
│  Adjudicator ▸ RuleEngine ▸ Escalation ▸ Human        │  HITLControls (only if ESCALATED)  │
└ AuditDrawer (hash-chain verifier ✓, slide-over) ────────────────────────────────────────┘
```

## Foundation the lead builds FIRST (the shared contract — freeze before spawning)
- [ ] **F1 Reconcile `lib/types.ts`** to backend ground truth: `CaseState` →
      `OPEN|UNDER_REVIEW|FLAGGED|ESCALATED|CLOSED`; `RuleStatus` → `ACTIVE|SHADOW|RETIRED`.
- [ ] **F2 `lib/desk/model.ts`** — folds `events[]` → `{ case, rules[], stats, dossiers[],
      activeAgent, bandWaiting }` via selectors over the trace store. THE interface
      teammates code against. Ship as typed stub returning derived state from current events.
- [ ] **F3 Mock orchestration `lib/desk/controller.ts`** + fixtures: `runBeatA()`
      (instant FLAGGED), `runBeatB()` (PASS→ESCALATED, awaits confirm), `confirm()`
      (appends codify tail: 5th rule rises, case ESCALATED→FLAGGED, regression-gate ✓),
      `reject()`. Extend MockAdapter to select a fixture by name/replay id.
      Fixture `content` strings MUST satisfy parseMarker regexes.
- [ ] **F4 Audit fixture** — hash-chained `LedgerEntry[]` + `verified:true` for the drawer.

## Team tasks (disjoint owners — no two teammates touch the same file)
### Teammate B — TopologyGraph (`components/desk/topology/*`)
- [ ] ~12 nodes, BandSpine center, R&D left / Surveillance right, Chinese-wall divider.
- [ ] Node state from `model.activeAgent` + markers; edges labeled by BandKind.
- [ ] **Investigator → `--band-blue` "waiting on Band" pulse** (`.anim-band-pulse`,
      traveling edge pulse) — the load-bearing visual. Verdict-flip node animation.
- [ ] `useReducedMotion` fallback (final state, no motion).

### Teammate C — Stats + Timeline + Rules (`components/desk/StatsBar|VerdictTimeline|RuleRegistryPanel.tsx`)
- [ ] StatsBar: count-up; live Active Rules/Flagged/Escalated from `model.stats`;
      narrative tiles (847/72%/41.2h) hard-coded (Q3, no backend source).
- [ ] VerdictTimeline: dots PASS=emerald/FLAG=red/ESCALATED=amber; PASS→FLAGGED flip on confirm.
- [ ] RuleRegistryPanel: 4 seed rules → 5th `codify-flash` reveal on confirm.

### Teammate D — Debate + HITL + Header + Audit (`components/desk/DossierCards|HITLControls|Header|AuditDrawer.tsx`)
- [ ] DossierCards: Prosecution(frontier=gold)⚔Defense(open=graphite) split, ModelBadge.
- [ ] HITLControls: visible only when `case.state==="ESCALATED"`; optimistic Confirm/Reject
      calling `controller.confirm/reject`; error states mapped (422/409/404) for later live.
- [ ] Header: logomark + ConnectionStatus + ReplayBanner + DemoControls (wire Beat A/B/R&D).
- [ ] AuditDrawer: slide-over, hash-chain rows, `verify_chain ✓/✗` from `audit.verified`.

## Lead integrates + verifies
- [ ] Compose all into `app/desk/page.tsx`; resolve token/layout conflicts.
- [ ] `npx tsc --noEmit` clean → `npm run build` exit 0 → `next start` + curl :4100/desk 200.
- [ ] weasyprint static render of `/desk` for layout proportions (flag 3D/shadow as eyeball-only).
- [ ] Demo dry-run: Beat A → flag; Beat B → escalate → Confirm → codify 4→5 + gate ✓.

## Out of scope this phase (deferred to live-integration)
Real backend wiring (Next proxy/CORS, TanStack Query callers), `/demo/rnd`, computed
narrative stats, Aeonik font swap, landing nav anchors, mobile/responsive.

## Review (2026-06-16 — DONE)

**Outcome:** `/desk` Command Center built in mock mode by a 4-teammate team against a
frozen `lib/desk/contract.ts` seam. Verified: `npx tsc --noEmit` exit 0 · `npm run build`
exit 0 (both `/` and `/desk` prerendered) · `next start` + `curl :4100/desk` → HTTP 200,
46KB, all section markers present (ALPHA & OVERSIGHT · LIVE DESK · Run Beat A/B · Active
Rules · Prosecution/Defense · topology nodes) · server log zero errors/warnings · landing
`/` still 200.

**Files created/changed:**
- Foundation (lead): `lib/types.ts` reconciled (UNDER_REVIEW/ACTIVE) + fixed stale
  literals in `lib/api/client.ts`; `lib/desk/contract.ts`, `lib/desk/nodes.ts`.
- DataLayer: enriched `lib/desk/model.ts` + `lib/desk/controller.ts`; new fixtures
  `beat-a.ts` (C-0191, instant FLAG, 9 frames), `beat-b.ts` (C-0187, PASS→ESCALATED, 9
  frames), `audit-C-0187.ts`; extended `lib/eventsource/adapter.ts`.
- Topology: `components/desk/topology/{TopologyGraph,PipelineNode,BandEdge,layout}` —
  @xyflow graph + the blue "waiting on Band" pulse + verdict-flip.
- Panels: `components/desk/{StatsBar,VerdictTimeline,RuleRegistryPanel}.tsx`.
- DebateHITL: `components/desk/{DossierCards,HITLControls,DeskHeader,AuditDrawer,
  ModelBadge,ConnectionStatus}.tsx`.
- Integration (lead): `app/desk/page.tsx` — auto-runs Beat B on mount; DemoControls
  re-trigger; AuditDrawer controlled by page state.

**NOT verified here (needs the user's browser — this env can't screenshot live pages):**
visual fidelity of the xyflow topology, the blue band-pulse breathing/traveling dot,
count-up animations, the codify 4→5 flash, and the Confirm spring. weasyprint is useless
for these (no JS/xyflow/3D/box-shadow). **Please eyeball `npm run dev` → :4100/desk and
run Beat A / Beat B → Confirm.**

**Known follow-ups (deferred by the mock-now decision):** connection state is set to
"connected" by the page (controller playback doesn't drive it — fine for demo); live
backend wiring (Next proxy/CORS, TanStack Query callers), `/demo/rnd`, computed narrative
stats, Aeonik font swap, landing nav anchors, mobile/responsive.
