# Alpha & Oversight — Frontend Working Reference

## 1. Project in one paragraph

Alpha & Oversight is an adversarial trade-surveillance multi-agent system (lablab.ai "Band of Agents" hackathon, Track 3: Regulated/High-Stakes). Two desks coordinate **through Band** across a Chinese wall: an **R&D desk** (red team) invents market-manipulation tactics that evade detection, and a **Surveillance desk** (blue team) catches them via an LLM-agent debate feeding a *deterministic* rule engine. The frontend has two surfaces: a **marketing landing page** (`/`, fully built, AlphaLedger-cloned scrollytelling) and a **live trace viewer / Command Center** (`/desk`, Phase 6, currently a stub). The frontend's #1 job is to **make Band's coordination visible** — a topology node turning **`#3b82f6` blue = "waiting on Band"** is the load-bearing visual ("blue cannot be a for-loop").

## 2. Domain model (exact terms)

**Case** (`state/state_machine.py`): unit of investigation. `case_id == room_id == Band room task_id`. Fields: `case_id`, `room_id`, `state` (CaseState), `verdict` (nullable), `features`, `events` (OrderEvent[]), `resolved_inputs`, `created_at`, `updated_at`. `events` + `resolved_inputs` are "codify sidecars" attached at terminal transition.

**CaseState enum (5, exact):** `OPEN | UNDER_REVIEW | FLAGGED | ESCALATED | CLOSED`. CLOSED is terminal.
Transitions (illegal ones raise):
- `(OPEN, "suspicious") → UNDER_REVIEW`
- `(UNDER_REVIEW, "flag") → FLAGGED` — **Beat A** (known pattern, rules fired)
- `(UNDER_REVIEW, "escalate") → ESCALATED` — **Beat B** (rules missed → human)
- `(FLAGGED, "close") → CLOSED`
- `(ESCALATED, "confirm") → FLAGGED` — human confirm → triggers codify
- `(ESCALATED, "reject") → CLOSED` — human dismiss
- `(any non-terminal, "timeout") → CLOSED`
Per-state timeouts (s): OPEN 30, UNDER_REVIEW 60, FLAGGED 30, ESCALATED 120, CLOSED 0.

**Two enums the frontend MUST NOT conflate:**
1. **Engine `Verdict.result`** = `"PASS" | "FLAG"` ONLY (deterministic rule engine). `Verdict = { result, rule_id (null on PASS), cited_metric (dict|null) }`.
2. **CaseState** (5 values above).
The CLAUDE.md "pass/flag/escalate/complete" verdict *colors* map to outcomes: pass = engine PASS, flag = FLAGGED, escalate = ESCALATED, complete = CLOSED. "escalate"/"complete" are case outcomes, NOT engine verdict values.

**Manipulation types / `RuleFamily` enum (4, LOWERCASE exact):** `spoofing`, `layering`, `wash_trade`, `marking`. Each has a deterministic detector returning `(tripped, cited_metric)`:
- **spoofing** — cited keys: `cancel_ratio, near_fill_cancel_ratio, spoof_side, window_ms, threshold`
- **layering** — cited keys: `depth_levels, cancel_span_ms, layer_side, window_ms, threshold`. **Beat-B headline evasion**: stretching the cancel cluster to ~400ms slips the 100ms seed rule.
- **wash_trade** — cited keys: `self_match_ratio, self_matched_qty, total_filled_qty, threshold`
- **marking** (marking-the-close) — cited keys: `eod_print_move_bps, ref_price, close_price, threshold`

**Triage features (`Features`, exact field names):** `cancel_to_fill: float`, `depth_levels: int`, `self_match_ratio: float`, `eod_print_spike: bool`. Terminal transition adds a `family` key.

**Specialist registry (family → @handle → trigger, first match wins):** spoofing → `@spoof-spec` (`cancel_to_fill > 0.7`); layering → `@layer-spec` (`depth_levels >= 3`); wash_trade → `@wash-spec` (`self_match_ratio > 0.5`); marking → `@mark-spec` (`eod_print_spike`).

**Seed rules (4, ACTIVE at boot; codify makes 5 — narrate "Active Rules 4→5"):** `FINRA-5210-layering` (window_ms 100, min_depth_levels 3) · `FINRA-5210-spoofing` (window_ms 100, min_cancel_ratio 0.8) · `SEC-10b-5-wash` (min_self_match_ratio 0.5) · `SEC-10b-5-marking` (min_print_move_bps 100.0). `Rule = { id, family, params, provenance, status }`, status default `"ACTIVE"`. Engine FLAGs on the FIRST active rule that trips.

**Live codify (THE demo wow moment, `rules/codify.py`):** on ESCALATED+confirm, `derive_rule` builds new rule id `{family}-v2-{case_id}`, provenance `human:{confirmed_by}/{case_id}`, widening window to `resolved.window_ms + 50ms`. `regression_gate` replays the original evasion through a registry incl. the new rule and ONLY permits codify if it now FLAGs.

**Adversarial debate flow (surveillance pipeline, `run_surveillance`):** 0. Open case (→OPEN) → 1. SanitizedBridge injects order flow (Chinese wall, events only) → 2. AnomalyDetector triages (LLM `suspicious` OR `is_abnormal(features)` floor; clean → timeout → CLOSED) → 3. Investigator (the ONLY tool-using/ReAct agent; recruits specialist via @mention → UNDER_REVIEW) → 4. Specialist proposes contested inputs (does NOT decide guilt) → 5. **Prosecution vs Defense debate** (staged sequential, `max_rounds` default 1; both emit `Dossier{headline, detail, claimed_inputs}`; Prosecution = frontier model, Defense = strong open model; load-bearing ONLY through `ResolvedInputs.window_ms`) → 6. Adjudicator resolves into `ResolvedInputs{window_ms, bona_fide_ids, intent}` → 7. **Deterministic rule engine** renders authoritative Verdict (no LLM overrules) → 8. EscalationManager builds human packet + `recommend ∈ {escalate, close, confirm}` → 9. Persist terminal state (FLAG→FLAGGED, else→ESCALATED).

**R&D co-evolution loop (`run_rnd`):** bounded K rounds (default 3). Adversary proposes `list[OrderEvent]` to evade current registry; two DETERMINISTIC oracles judge: **Oracle-1** = `engine.evaluate(...).result == "PASS"` (evaded); **Oracle-2** = `is_profitable_and_moved(...)` (P&L>0 AND moved price). Evade+profit = "confirmed novel evasion" → crosses to Surveillance via SanitizedBridge (events only). `RnDResult{confirmed, events, rounds, params}`.

**Audit chain (`audit/ledger.py`):** append-only hash-chained JSONL, compliance system of record. Each leaf `hash = sha256(prev_hash + canonical_json(entry))`; `canonical_json = json.dumps(sort_keys=True, separators=(",",":"))`. Envelope fields `band_message_id, prev_hash, hash` are NOT part of the hashed body. Genesis `prev_hash = ""`. `verify_chain` recomputes every link (tamper-evident). Two leaf variants share the chain envelope:
- **Band-handoff leaf:** `{ case_id, kind:BandKind, from, to, direction:"sent"|"received", sha256, bmid, band_message_id, prev_hash, hash }`
- **Agent-step leaf:** `{ agent, desk, role, content_sha256, band_message_id, prev_hash, hash }`
**BandKind enum:** `handoff | evidence | verdict | escalation | rule_codified`. Band Envelope: `{v, msg_id, case_id, from_(alias "from"), to, kind, payload}`, sent as `"@{to} " + json`.

**OrderEvent:** `{ action:OrderAction, order:ExchangeOrder, timestamp, trader_id }`. OrderAction: `PLACE|MODIFY|CANCEL|FILL`. Side: `BUY|SELL`. OrderStatus: `PENDING|OPEN|PARTIALLY_FILLED|FILLED|CANCELLED|EXPIRED|REJECTED`. (R&D `reasoning`/`model_key` stripped to `""` crossing the bridge.)

## 3. Backend API contract

FastAPI app `Alpha & Oversight`, `API_BASE` default `http://localhost:8000`. No auth, no global prefix. **No CORS configured** (flag if cross-origin). All POSTs take **no body**.

| Method/Route | Returns / Behavior |
|---|---|
| `GET /stream?desk=<rnd\|surveillance>&replay=<case_id>` | `text/event-stream`. No params = live all desks; `desk=` filters; `replay=` re-emits recorded JSONL at original cadence (gap capped 5s; **replay overrides desk**; missing file = empty stream). |
| `GET /cases` | `Case[]` ordered by `created_at, case_id` |
| `GET /cases/{case_id}` | `Case`; `404 {detail}` if unknown |
| `GET /cases/{case_id}/audit` | `{ case_id, entries: LedgerRow[], verified: bool }` (verified = fresh `verify_chain` over whole ledger) |
| `GET /rules` | `Rule[]` (active only): `{ id, family, params, provenance, status }` |
| `GET /stats` | `{ total_cases:int, by_state:{<UPPERCASE_STATE>:int}, flagged:int, escalated:int, active_rules:int }` |
| `POST /cases/{case_id}/confirm` | ESCALATED→FLAGGED + derive/gate/codify. Returns `{ case:Case, codified:true, regression_passed:true, rule:{id,family,params,provenance,status} }`. Errors: `404` unknown · `409` not ESCALATED · `422` regression gate failed (rule NOT codified) |
| `POST /cases/{case_id}/reject` | ESCALATED→CLOSED, codifies nothing. Returns `{ case:Case, codified:false }`. Errors: `404` · `409` |
| `POST /demo/beat-a` | Clean layering → instant FLAGGED. Returns `{ case_id, state, verdict }` |
| `POST /demo/beat-b` | Novel 400ms evasion → PASS → ESCALATED (awaits confirm). Returns `{ case_id, state, verdict(null\|Verdict) }` |
| `POST /demo/rnd` | **PLANNED, NOT built** (Q2). Client stub exists; Beat-B is the stand-in for the R&D lane. |

### `/stream` SSE marker protocol
- Frame format: `data: <compact-json>\n\n`. Heartbeat: SSE **comment** `: keep-alive\n\n` every 15s idle — **frontend MUST ignore lines starting with `:`**.
- All frames are unnamed `message` events (no SSE `event:` discrimination) — branch on `agent_name` in the JSON body.
- **Every data frame = `ActivityEvent`:** `{ agent_name:str, model_id:str, desk:"rnd"|"surveillance", content:str|null, reasoning:str|null, tool_calls:dict[], created_at:ISO8601 }`. Replay frames add `replay_ts`. `tool_calls` items: `{ name, id, arguments, result }`.
- **The "marker" = `content` on `agent_name:"pipeline"` events** (desk always `surveillance`, `model_id:""`). These human-readable strings drive topology/timeline and MUST be string-parsed (`parseMarker`):
  - `opened case <case_id>`
  - `detector clean -> CLOSED` (early-exit, no manipulation)
  - `suspicious -> UNDER_REVIEW; features={...}`
  - `recruited <handle> (<family>)`
  - `debate complete`
  - `verdict=<PASS|FLAG> rule=<rule_id|None>`
  - `case <case_id> -> <FINAL_STATE>`
- Other producers on the same bus: **agent-step events** (`agent_name` = agent, e.g. anomaly-detector/investigator/specialist/prosecution/defense/adjudicator/escalation; `content` = structured JSON-as-string; `reasoning` + `tool_calls` populated); **Band-handoff events** (`agent_name` = envelope `from_` e.g. `bridge`/`adjudicator`/`escalation`; `content` = `@mention + json` envelope string; `desk` = sending desk).

## 4. Visual identity & landing-page structure

### Color tokens (in `app/globals.css`)
**Monochrome backbone:** `#020202` Obsidian (dark bg) · `#FEFEFE` Frost (light bg/text) · gray ramp `#2B2B2B` Charcoal / `#494949` Gunmetal / `#636363` Slate / `#7F7F7F` Ash. Env: `--bg-light-2 #FBFBFB`, `--card-light #F7F7F7`, `--card-dark #0F1011`, `--card-dark-2 #16181C`, `--border-dark #2A2A2A`, `--hairline #E7E7E7`, muted-light `#646464` / muted-dark `#888888`. (HeroScroll H1 near-black `#14161c`; black pill `#181a1f`.)

**Semantic accents — THE ONLY CHROMA, each load-bearing:**
- `#3b82f6` **Band blue** — `waiting_on_band` ONLY (SACRED/fixed; NOT the app's `#6366f1` logomark glow)
- `#ef4444` Red — FLAG · `#f59e0b` Amber — ESCALATED · `#34d399` Emerald — PASS / verify ✓ · `#10b981` complete/CLOSED
- `#6b7280` Graphite — R&D/Adversary desk (tone-only, no hue) · `#9aa6c4` Light slate — Surveillance desk (tone-only)
- Model badge: frontier = gold · open = graphite.

**Token gotcha:** `[data-section="light"]` remaps tokens to the white theme. A fixed/position element NOT nested inside `data-section="light"` resolves tokens to ROOT (dark) values (this caused an invisible navbar). Use explicit hex (`#14161c`/`#fff`) on light frames, or the deterministic luminance scroll-spy in `LandingNav.tsx`.

### Typography
Aeonik (geometric sans; fallback Aktiv Grotesk/Söhne; **NEVER Inter/Roboto**) — currently stood in by **Geist Sans** (swap to `next/font/local` Aeonik later, one file). **Geist/JetBrains Mono for ALL data** (IDs, hashes, params, timestamps, stat labels). **Signature: two-tone headings** — line 1 ink, line 2 muted gray. Eyebrow labels ~11-13px UPPERCASE tracked ~0.15em, paired with a top-right logomark anchor (space-between) as the section divider — no graphic dividers. framer ease tuples MUST be typed `[0.16,1,0.3,1] as [number,number,number,number]`.

### Landing composition (`app/page.tsx`, top→bottom, hard light↔dark cuts)
`<Preloader/>` then `<main>` with `<HeroScroll/> <KeyFigures/> <ManifestoSection/> <FeaturesCarousel/> <UnlockSection/>`:
0. **Preloader** — full-screen Obsidian `#020202` splash, centered white logomark/wordmark, once per session, fades to hero.
1. **HeroScroll** — white bg, sticky white nav (~60-70px); centered H1 ~40-48px light `#14161c` with a **rotating second word** (Sentinel./Adversary./Auditor.); gray sub max-w ~400px; down-arrow cue; silver MacBook dark-dashboard mockup that **GSAP-pins and zooms/tilts to "dive into the screen"** (frame 0001 small/far → 0004 screen-filling, 330vh runway, 4 frames).
2. **KeyFigures** — white bg, 3-col rAF count-up stats (847 alerts / 72% FP blocked / 41.2h saved) on scroll into view, then hairline + uppercase tracked tagline.
3. **ManifestoSection** — white bg, large centered paragraph (~40-48px light, max-w ~700-800px) that **fills word-by-word gray→ink on scroll progress**.
4. **FeaturesCarousel** — WHITE bg, eyebrow "FEATURES" + "Our Features" heading; section **PINS while dark rounded cards (~16px radius, `#0f1011`–`#16181c`, white text) translate right→left on scrollY**; "← SCROLL" affordance fades. A&O variant = 6 numbered loop-step cards (01 Adversary invents · 02 Band transmits · 03 Surveillance detects · 04 Debate · 05 Escalate · 06 Codify+gate) + bottom stat row (197 TESTS / 4→5 RULES / 0 REGRESSIONS / <3s CODIFY).
5. **UnlockSection** (closing CTA) — dark `#020202`, two-tone heading "Unlock The **Full Power** of Quantitative Trading" ("Full Power" lighter **gray**, NOT amber); 2×2 cards (01-04 ordinals, fills `~#1e1e1e` borders `~#3a3a3a`) arranged AROUND a central near-octagonal SVG shield/logomark emblem with glow halo; cards fade-up/scale-in stagger, widget settles last.

### Signature interactions (3 desk motion moments, for `/desk`)
1. **Rule Codification + Regression Gate (≤3s):** CONFIRM→spinner → badge ESCALATED→FLAGGED spring → StatsBar 4▸5 roll → 5th rule card rises amber → "✓ regression gate PASS" wipes in → border decays → feedback edge pulse to R&D.
2. **Band "Waiting" Pulse:** Investigator frost→`#3b82f6`, "▓ waiting on Band ▓", breathing halo ~55bpm, traveling edge pulse Investigator→Specialist every 1.4s.
3. **Verdict Flip:** node ESCALATED amber-ring → flip rotateX front amber/back red → timeline segment re-shades amber→red → StatsBar FLAGGED++/ESCALATED--.
Every animated component needs a `useReducedMotion` fallback rendering the final state immediately.

## 5. Current frontend state

**Stack/versions:** next `16.2.9`, react/react-dom `19.2.4`, framer-motion `^12.40.0`, gsap `^3.15.0`, @xyflow/react `^12.11.0`, recharts `^3.8.1`, zustand `^5.0.14`, @tanstack/react-query `^5.101.0`, clsx `^2.1.1`, tailwindcss v4 (`@tailwindcss/postcss`), typescript `^5`, eslint `^9`. **Dev port 4100.**

**BUILT & complete:**
- **App shell:** `layout.tsx` (Geist Sans/Mono via next/font/google, wraps `<Providers>`), `providers.tsx` (React Query, staleTime 5s — _now wired: `/desk` queries `/cases`,`/rules`,`/stats`,`/audit` and `useInvalidateOnMarkers` invalidates them on SSE markers (debounced on codify)_), `page.tsx` (full landing), `globals.css` (authoritative tokens + `[data-section="light"]` remap + keyframes `band-pulse`/`fade-up`/`codify-flash`/`scroll-cue` + reduced-motion kill-switch).
- **12 landing components, all with reduced-motion fallbacks:** `Preloader`, `HeroScroll` (GSAP), `LandingNav` (luminance scroll-spy, explicit-hex), `KeyFigures`, `ManifestoSection`, `FeaturesCarousel` (GSAP), `UnlockSection` (**new/untracked** — only `page.tsx` diff is +2 lines importing/rendering it), `Logomark`, `CommandCenterArt`, `art/AuditChainArt`, `art/ThreatLeaderboardArt` (CrossModelArt inline in FeaturesCarousel).
- **Data layer (`lib/`), fully built + swap-proof, consumed ONLY by `/desk` stub:** `config.ts` (DATA_MODE mock|live, API_BASE), `api/client.ts` (all REST + POST confirm/reject/demo, `rnd()` flagged not-on-backend), `eventsource/adapter.ts` (`MockAdapter` replays fixtures @900ms ↔ `LiveSSEAdapter`→`/stream`, `createAdapter()` by DATA_MODE), `eventsource/parseMarker.ts` (brittle regex → `Marker`), `store/useTraceStore.ts` (zustand: events/connection/latestByAgent), `types.ts` (mirrors backend verbatim), `fixtures/events-C-0187.ts` (8-event mock stream).

**BUILT & LIVE-VERIFIED (2026-06-17) — the `/desk` Command Center:** the desk is built and wired to live SSE/REST; E2E green; the data layer is complete. VISUAL redesign is deferred (the current desk look is rejected/slated for a presentation rebuild — the contracts and data wiring stay). StatsBar, the HITL Confirm/Reject controls, RuleRegistryPanel (dynamic `4 → 5`), AuditDrawer (a11y focus-trap + live `verify_chain`), ConnectionStatus/ErrorBanner, the CoEvolutionLadder, and the model view all render off real data. `LiveSSEAdapter` now escalates to a real "error" connection state on persistent failure; `useTraceStore.connect()` holds a single `/stream` EventSource across beats; `useInvalidateOnMarkers` debounces the codify `/rules`+`/stats` refetch. 65 vitest tests across 5 suites cover the data layer; backend `ledger.append()` is lock-guarded with a concurrency test. Mock mode (`npm run dev`, the default `NEXT_PUBLIC_DATA_MODE`) shows the Beat-B fixture immediately; many error/recovery behaviours above are LIVE-ONLY (`NEXT_PUBLIC_DATA_MODE=live` + a running backend).

> _Historical (pre-2026-06-17): this section described `/desk` as a "FOUNDATION PROOF" stub — only adapter→store→render with no StatsBar/Topology/RuleRegistry/VerdictTimeline. That gap is now closed for the data layer; only the desk **visuals** remain deferred to the redesign._

**Decorative-only (NOT wired to data):** `CommandCenterArt`, `AuditChainArt`, `ThreatLeaderboardArt` are static mock presentation art for the laptop screen / feature cards — explicitly decoupled from real `/desk`.

## 6. What's left to build (prioritized)

**Route note:** treat `/` = landing (done), `/desk` = live dashboard (per CLAUDE.md; build plan's older "Command Center at `/`" is superseded). Case Audit recommended as a **drawer** over `/desk`, not a separate route, to keep the single-screen demo.

**P0 — `/desk` Command Center (wire data layer into real UI):**
1. **StatsBar** (light section) — count-up; bind Active Rules + flagged + escalated live from `/stats`; narrative tiles (847 alerts / 72% FP / 41.2h) hard-coded (Q3 — `/stats` doesn't compute them).
2. **TopologyGraph** (`@xyflow/react`, ~12 nodes: BandSpine center, R&D Adversary, SanitizedBridge wall, AnomalyDetector, Investigator, Specialist, Prosecution, Defense, Adjudicator, RuleEngine, EscalationManager, Human) — the centerpiece. **Investigator node turns `#3b82f6` "waiting on Band"** (inferred from event sequence — heuristic: blue between a node emitting its outbound step and the next desk's node activating). Edges labeled by BandKind.
3. **DossierCards** (Prosecution⚔Defense cross-model split, ModelBadge frontier=gold/open=graphite).
4. **VerdictTimeline** (PASS=emerald / FLAG=red / ESCALATED=amber dots; PASS→FLAGGED flip on confirm).
5. **RuleRegistryPanel** (4→5 codify reveal).
6. **HITLControls** (visible only when ESCALATED; **optimistic** Confirm: flip case→FLAGGED + insert rule + bump Active Rules BEFORE refetch, rollback on non-200; error map 422 gate-failed / 409 not-escalated / 404 unknown).
7. **DemoControls** (Run Beat A / Beat B / R&D), **ConnectionStatus** + **ReplayBanner**, **ModelBadge**.

**P1 (all locked, presentation-priority order):** C1 Live codify+regression-gate reveal (THE money moment, ≤3s) → C2 Band waiting-pulse + Delete-Band toggle → C4 Audit hash-chain verifier drawer (`verify_chain ✓`/✗ from `audit.verified`) → C5 Replay scrubber (0.5×/1×/2×/4×) → C3 Adversary⚔Surveillance split view → Beat-sheet auto-pilot "Run 90s Demo". If cut: ship 1→2→3, then 4, then 5.

**Other gaps:**
- ~~Wire **TanStack Query** to REST (`/cases`,`/rules`,`/stats`,`/audit`), invalidated on SSE markers — currently zero callers.~~ **DONE 2026-06-17** — wired via `useInvalidateOnMarkers` (codify refetch debounced); see §7 RESOLVED.
- **Landing nav anchors** `#overview`/`#how-it-works`/`#audit` have no matching id'd sections (only Live Desk→`/desk` resolves). Either add sections or a `/how-it-works` route (P1, decision D2: Hero→text-fill thesis→6-chapter pinned carousel→count-up proof→CTA).
- Swap Geist → licensed Aeonik via `next/font/local` (one file).

**P2:** per-node click-to-filter · case search/family filter · τ slider · OG/Vercel deploy · keyboard hotkeys (A/B/C) · sound cue.

## 7. Open questions / risks (deduped)

### RESOLVED 2026-06-17
- **Q6 (case_id attribution) — RESOLVED 2026-06-17:** addressed on the frontend with a `latestCaseId()` helper (the desk derives the active case from the event stream rather than relying on a per-frame `case_id`); the concurrent-run risk is mitigated and the audit ledger is now lock-guarded backend-side (no forked `prev_hash`).
- **Q5 (parseMarker grammar) — RESOLVED 2026-06-17:** the `parseMarker` grammar is verified by tests (31 of the 65 vitest cases) and a DEV-only `console.warn` now fires when a `pipeline` frame yields no recognised marker (guarded by `NODE_ENV !== "production"`, never alters output) — so backend marker drift is loud in dev instead of silent.
- **TanStack Query wiring — RESOLVED 2026-06-17:** React Query is now wired via `useInvalidateOnMarkers` (no longer "zero callers"); `/desk` queries `/cases`,`/rules`,`/stats`,`/audit` and invalidates on SSE markers (codify refetch debounced ~500ms so Active Rules doesn't flicker 5→4→5).
- **"Zero tests" — RESOLVED 2026-06-17:** the frontend now has **65 vitest tests across 5 suites** (vitest configured with node + jsdom projects): `parseMarker` (31), `useTraceStore`, `LiveSSEAdapter` (node); `useDeskModel`, `HITLControls` (jsdom). Run `npm run test`. Backend adds a ledger concurrency test (`pytest backend/tests/test_ledger.py`, 12 passed). Verification is no longer tsc/build/curl-only.

> _The items below are retained as historical/open context; the four above supersede their stale "wire-later"/"zero tests" framing._

**Backend gaps (mock-now, wire-later):**
- **Q6 (flagged "most important"):** `ActivityEvent` has **NO `case_id`** → can't attribute frames under concurrent runs. `types.ts` mocks `case_id?`. _(RESOLVED 2026-06-17 — see above: `latestCaseId()` helper + lock-guarded ledger.)_
- **Q5:** no structured `stage`/`event_type` field — UI must string-parse human-readable pipeline markers via the brittle `parseMarker` regex until backend adds structured fields. _(RESOLVED 2026-06-17 — see above: parseMarker verified by 31 tests + DEV-only drift warning.)_
- **Q2:** `POST /demo/rnd` not built — Beat-B canned evasion stands in for the R&D lane.
- **Q3:** `/stats` returns counts only — narrative tiles (FP%, analyst-hrs, alerts 847/72%/41.2h) must be hard-coded.
- **CORS:** none configured in `app.py` — cross-origin EventSource/fetch from port 4100 may be blocked. Confirm backend adds CORS or is reverse-proxied same-origin.
- **Backend port** not defined in code (set at launch) — `lib/config` `API_BASE` default `http://localhost:8000` must point at the right base URL.
- Also unbuilt/absent: `/close` route (Q8), `/replays` discovery endpoint (Q9), Adversary model-badge alias (Q10).

**Behavioral confirmations needed:**
- **Route structure:** confirm `/desk` = dashboard and `/` = landing is the intended final layout (build-plan/CLAUDE.md drift).
- **"Waiting on Band" is INFERRED** from event sequence (SSE emits no explicit "waiting" event) — confirm the blue-between-outbound-and-next-activation heuristic is what ships.
- **StatsBar binding:** confirm hard-coding narrative tiles + live-binding only Active Rules/flagged/escalated is acceptable for the demo.
- **Audit as drawer vs `/cases/{id}` route** — confirm drawer (preserves single-screen demo).
- **`/desk` REST usage:** ~~confirm whether `/desk` uses REST (cases/rules/stats) alongside the SSE store, or SSE-only (React Query provider is mounted with zero callers).~~ **RESOLVED 2026-06-17** — `/desk` uses REST (`/cases`,`/rules`,`/stats`,`/audit`) via React Query alongside the SSE store, invalidated on markers (see §7 RESOLVED).
- **"complete" color:** no `complete` state/verdict exists — treat `complete` = CLOSED (`#10b981`); confirm no distinct "complete" badge intended.
- **Audit row rendering:** ledger leaves store only `content_sha256` (not content) — how the UI renders human-readable audit rows from sha-only leaves is unclear; may need a join back to replay JSONL.
- **`Verdict.model_dump()`** in `/demo` responses uses default (not `mode="json"`) — confirm no datetime/enum surprises in `cited_metric`.

**Design/visual confirmations:**
- **"Full Power"** highlight = lighter **gray**, NOT amber/gradient (amber is reserved for ESCALATED) — confirm.
- **Nav visibility** across all hard light↔dark cuts (the invisible-navbar token gotcha) — confirm luminance scroll-spy holds.
- **Logomark** exact angular glyph — recreate from existing `Logomark.tsx`/live SVG, don't invent.
- **AlphaLedger scope:** A&O landing is the 5-component composition only; confirm none of AlphaLedger's ~17 extra sections (Pricing, FAQ, Footer, etc.) are in scope.
- **Mobile/responsive** unconfirmed (all refs desktop ~1100-1470px) — pinned horizontal Features carousel + device-zoom hero need a documented mobile fallback.
- **Decorative art mapping:** if real `/desk` must visually match `CommandCenterArt`/`AuditChainArt`/`ThreatLeaderboardArt`, that mapping isn't captured in code.
- **`frontend-design/` reference assets** (numbered PNGs, `*-fucked.png` = hallucinated, `.mov` walkthroughs) are LOCAL-only (never pushed) — compare pixel-for-pixel, don't invent drift. 3D tilt/perspective/box-shadow glow can't be weasyprint-verified — need the user's eyeball.

**Process:** ~~no tests present~~ **65 vitest tests across 5 suites now exist (RESOLVED 2026-06-17, run `npm run test`)** plus backend `pytest backend/tests/test_ledger.py`; tsc/build/curl verification still applies per CLAUDE.md (`npx tsc --noEmit` authoritative → `npm run build` exit 0, rebuild before `next start` → curl :4100 for 200 + grep markers → weasyprint PDF for static layout). The 2026-06-17 update was dynamically verified end-to-end (tsc clean, build exit 0, vitest 65/65, pytest 12/12, landing/how-it-works strings grepped on a fresh build). See `VERIFICATION_GUIDE.md`.