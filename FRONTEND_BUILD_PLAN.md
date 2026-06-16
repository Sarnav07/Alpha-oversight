# Alpha & Oversight — Frontend Build Plan
### Cloned in the **AlphaLedger** visual identity · frontend-only now, integrate to live backend later

> **Status:** 🟢 CONFIRMED — D1–D4 locked (2026-06-15). Building page-mockup PDF next.
> **Sources:** `ALPHALEDGER_SPEC.md` (PRIORITY — color + scroll/motion), `FRONTEND_SPEC.md` (functional contract), `OMNICURVE_SPEC.md` + `PREDICTIONARENA_SPEC.md` (component/data-viz ideas). Synthesized via multi-agent research (6 agents) + the `frontend-design` and `ui-ux-pro-max` skills.
> **Design POV (one line):** *AlphaLedger's austere monochrome makes the few permitted colors scream — so every chromatic pixel here is a compliance signal (blue = Band-blocked, amber = R&D/escalation, periwinkle = surveillance, red = FLAG, emerald = PASS/verified), and the whole demo is choreographed as one continuous AlphaLedger "beat": splash → hard-switch sections → pinned reveals → count-up → the codify flip.*

---

## §0 — CONFIRMED DECISIONS (2026-06-15)

| # | Decision | LOCKED CHOICE |
|---|---|---|
| D1 | **Theme direction** | ✅ **Hard light↔dark alternation** (full AlphaLedger rhythm — abrupt white↔dark cuts everywhere, incl. the live Command Center). See **§1b Section Transition System** — the auto-inverting nav is the "crazy" AL move the user called out. |
| D2 | **`/how-it-works` scrollytelling route** | ✅ **Yes** — included (P1). Demo opener + pinned-carousel showcase + SSE-flake fallback. |
| D3 | **Desk accent colors** | ✅ **Tone-only (no hue):** R&D/Adversary = **graphite `#6b7280`**, Surveillance = **light slate `#9aa6c4`**. Stays fully monochrome per AL restraint; hue reserved entirely for status (blue=Band, red=FLAG, amber=ESCALATED, emerald=PASS). |
| D4 | **P1 "wow" features** | ✅ **Lock ALL** — built in presentation-priority order (§5). |

---

## §1 — DESIGN TOKENS (AlphaLedger monochrome backbone + semantic accents)

```css
/* ============================================================
   ALPHA & OVERSIGHT — DESIGN TOKENS
   Backbone: AlphaLedger monochrome. Accents are SEMANTIC ONLY.
   ============================================================ */
:root {
  /* ---- CORE MONOCHROME (AlphaLedger verbatim) ---- */
  --obsidian:#020202; --frost:#FEFEFE; --charcoal:#2B2B2B;
  --gunmetal:#494949; --slate:#636363; --ash:#7F7F7F;

  /* ---- SURFACES (dark-first; compliance command center) ---- */
  --bg-page:#020202; --bg-section-alt:#070707; --bg-nav:#060606;
  --bg-card:#0f1011; --bg-card-2:#16181c; --bg-card-hover:#1b1e23; --bg-inset:#0a0b0d;

  /* ---- BORDERS / HAIRLINES ---- */
  --border-subtle:#2a2a2a; --border-default:#3a3a3a; --border-strong:#4a4a4a; --hairline:#1c1d1f;

  /* ---- TYPOGRAPHY COLORS ---- */
  --text-primary:#FEFEFE; --text-body:#c7ccd1; --text-muted:#888888;
  --text-faint:#5f5f5f; --text-on-light:#14161c;

  /* ===== SEMANTIC ACCENTS — the ONLY chroma allowed (each load-bearing) ===== */
  --band-blue:#3b82f6; --band-blue-glow:#3b82f655; --band-blue-dim:#1e3a5f; /* waiting_on_band (FIXED) */
  --desk-rnd:#6b7280; --desk-rnd-soft:#6b728022;      /* adversary / R&D lane (graphite — TONE ONLY, D3) */
  --desk-surv:#9aa6c4; --desk-surv-soft:#9aa6c422;    /* surveillance lane (light slate — TONE ONLY, D3) */
  --verdict-pass:#34d399; --verdict-flag:#ef4444; --verdict-escalate:#f59e0b; --verdict-complete:#10b981;
  --status-idle:#4a4f57; --status-active:#FEFEFE; --status-waiting:var(--band-blue); --status-done:#10b981; --status-error:#ef4444;
  --tier-frontier:#c9a227; --tier-open:#6b7280;       /* model badges: frontier gold / open graphite */

  /* ---- TYPE (Aeonik family; mono for all data) ---- */
  --font-display:"Aeonik","Aktiv Grotesk","Söhne","Foundry Grotesk",sans-serif;
  --font-mono:"Aeonik Mono","JetBrains Mono","Geist Mono",ui-monospace,monospace;
  --fs-hero:clamp(48px,7vw,220px); --fs-h1:clamp(40px,5vw,64px); --fs-h2:clamp(28px,3.2vw,48px);
  --fs-h3:22px; --fs-stat:clamp(32px,4vw,64px); --fs-body:15px; --fs-sm:13px;
  --fs-eyebrow:11px; --fs-mono:13px;
  --fw-light:300; --fw-regular:400; --fw-medium:500; --fw-bold:700;
  --tracking-eyebrow:0.15em; --tracking-mono:0.02em;

  /* ---- RADII / SPACING / SIZES ---- */
  --r-card:14px; --r-pill:9999px; --r-chip:6px; --r-well:10px; --r-node:12px;
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px;
  --s-7:48px; --s-8:64px; --s-9:96px; --s-10:120px;
  --maxw-content:1280px; --maxw-text:720px;

  /* ---- SHADOWS / MOTION / TEXTURE ---- */
  --shadow-card:0 2px 12px rgba(0,0,0,0.45); --shadow-raise:0 8px 32px rgba(0,0,0,0.55);
  --shadow-glow-band:0 0 0 1px var(--band-blue),0 0 24px var(--band-blue-glow);
  --shadow-glow-flag:0 0 0 1px var(--verdict-flag),0 0 20px #ef444433;
  --ease-out:cubic-bezier(0.16,1,0.3,1); --ease-spring:cubic-bezier(0.34,1.56,0.64,1);
  --dur-fast:180ms; --dur-reveal:600ms; --dur-count:1400ms; --stagger:120ms;
  --hatch:repeating-linear-gradient(45deg,transparent,transparent 6px,#ffffff05 6px,#ffffff05 7px);
}
/* Hard LIGHT-section inversion (AlphaLedger signature switch) */
[data-section="light"]{
  --bg-page:#FFFFFF; --bg-card:#FBFBFB; --text-primary:#14161c; --text-body:#3a3a3a;
  --text-muted:#646464; --border-default:#e7e7e7; --hairline:#e7e7e7;
}
```

**Rationale (desk colors — D3 locked):** Fully tone-only per AlphaLedger's no-chroma rule. The two desks read by **graphite (R&D)** vs **light slate (Surveillance)** — value contrast, not hue. ALL hue is reserved for *status* signals (blue=Band-waiting, red=FLAG, amber=ESCALATED, emerald=PASS/verify), so nothing competes. Desk identity is reinforced by **lane position** (R&D bottom / Surveillance top) and the SanitizedBridge wall, not color.

---

## §1b — SECTION TRANSITION SYSTEM (the "crazy" AlphaLedger move — D1)

AlphaLedger's signature is **abrupt full-bleed inversions with zero gradient morph** — white → obsidian → white, snapping at section edges, with every element flipping fill. We replicate the mechanism exactly:

1. **Hard cuts, no blend.** Each band is `[data-section="light"|"dark"]`; adjacent bands are opposite. No gradient transition — the cut lands precisely at the band boundary (this abruptness *is* the effect).
2. **Auto-inverting sticky nav (the slick part).** The fixed nav uses **`mix-blend-mode: difference`** (white nav content over any bg auto-inverts to readable contrast as dark/light bands scroll under it) — *or*, for finer control, an IntersectionObserver flips `data-nav="on-dark|on-light"` as each band crosses the nav line. Either way the nav appears to **invert live while you scroll**.
3. **Element fill inversion.** Pill buttons swap fill across the cut: **black-fill/white-text on light**, **white-fill/black-text on dark**; ghost = 1px border. CTAs invert automatically because they read `currentColor`/tokens, not hard-coded hex.
4. **Every band opens with the AL anchor device:** small-caps **eyebrow label (top-left)** + **logomark anchor (top-right)** — the sole sectioning motif, giving rhythm without dividers.
5. **Entry motion per band:** light bands → count-up / text-fill reveals; dark bands → fade-up + scale-in stagger (Unlock-grid) and the pinned-carousel. Reveals fire on `IntersectionObserver` enter-view.

**Command Center band rhythm (hard cuts, top→bottom):**
`Splash ▮dark` → `Nav (auto-invert)` → `StatsBar ▯LIGHT` → `Topology ▮DARK` → `Feed+Dossiers ▮DARK` → `RuleRegistry ▯LIGHT` → `VerdictTimeline ▮DARK`.
Colored status nodes/badges are tuned to read on **both** surfaces (each accent has a light-bg and dark-bg variant via the `[data-section]` overrides).

**`/how-it-works` rhythm:** `Hero ▯white` → `text-fill thesis ▯white` → `The Loop pinned carousel ▮dark` → `count-up proof ▯white` → `CTA ▯white`.

---

## §2 — PAGE MAP

| # | Route | Purpose | AlphaLedger pattern adopted |
|---|---|---|---|
| 1 | `/` | **Command Center** — live read-only trace viewer; all P0 real-time components on one screen | **Hard-dark dashboard** (AL's authenticated-app register); hero = live TopologyGraph; eyebrow-label + logomark-anchor sectioning |
| 2 | `/cases/{id}` | **Case Audit** — drawer over `/`; immutable lineage + hash-chain verify | **Sticky-left + scrolling-right** ("Why AlphaLedger" pattern) |
| 3 | `/?replay=<case_id>` | **Replay Mode** — same Command Center, recorded SSE cadence + banner/scrubber | `/` + persistent **ReplayBanner** ("Coming soon" pill) + scrubber (Monthly/Yearly toggle track) |
| 4 | `/how-it-works` *(P1, D2)* | **Explainer scrollytelling** — pinned horizontal carousel + chapter cards; demo opener & SSE-flake fallback | **Pinned horizontal-scroll carousel** (AL signature) + text-fill reveal + count-up |

---

## §3 — PER-PAGE LAYOUT

### PAGE 1 — `/` Command Center
Dark-dominant (`--bg-page` obsidian, `--bg-card` cards). Eyebrow-label/logomark-anchor opens every band. Top→bottom:

| Section | Components | FRONTEND_SPEC binding |
|---|---|---|
| 0. Splash (first load) | Obsidian full-screen, white "ALPHA & OVERSIGHT" wordmark, fade-out | none (motion) |
| 1. Nav (sticky ~64px) | logo+wordmark · `Command Center · How it works · Audit` · **ConnectionStatus** pill · **DemoControls** | ConnectionStatus ← SSE state; DemoControls → `POST /demo/beat-a`,`/beat-b`,`/rnd` |
| 2. **StatsBar** (count-up) | tiles: Total Cases · Flagged · Escalated · **Active Rules 4→5** (hero) · FP-Blocked%* · Analyst-hrs* | `GET /stats` + `GET /rules`; `*`=hard-coded narrative (Q3) |
| 3. **TopologyGraph** (centerpiece) | ~12-node @xyflow graph; Surveillance lane / R&D lane / BandSpine / SanitizedBridge wall / Human; ModelBadges; **Investigator → blue waiting_on_band**; edges pulse, labeled by BandKind | SSE `ActivityEvent`(agent_name, model_id, desk) → node/edge status |
| 4. Two-col split | **L:** LiveActivityFeed (avatar, name, duration badge, desk chip, model badge, expandable reasoning, prepend). **R:** DossierCards (⚔ Prosecution / 🛡 Defense, frontier vs open badges) | Feed ← SSE; Dossiers ← SSE prosecution/defense events |
| 5. **RuleRegistryPanel** | rows: id · family · params(mono JSON) · provenance · status; **4 seed → 5 on codify** (fade-up+scale stagger+flash) | `GET /rules`; refetch on `rule_codified` SSE / confirm 200 |
| 6. **VerdictTimeline** | horizontal case timeline; state badge, verdict.result, rule_id; **PASS→FLAGGED flip on confirm**; click → Case Audit | `GET /cases` + SSE |
| 7. **HITLControls** (conditional) | over ESCALATED card: Confirm (frost-fill) / Reject (ghost); spinner→flip; error→toast+rollback | `POST /cases/{id}/confirm`·`/reject` |

### PAGE 2 — `/cases/{id}` Case Audit (drawer)
Sticky-left summary (state, verdict, features, resolved_inputs, "Verify chain") + scrolling-right **AuditLineage** hash-chain (each LedgerEntry: agent·desk·role·content_sha256·band_message_id·prev_hash→hash, drawn as a literal connected chain; header `verify_chain ✓/✗`). Binds `GET /cases/{id}` + `GET /cases/{id}/audit`.

### PAGE 3 — `/?replay=<case_id>` Replay
Pixel-identical to `/` + persistent **ReplayBanner** + **scrubber** (play/pause/speed, event markers) driven by `GET /stream?replay=<id>`.

### PAGE 4 — `/how-it-works` *(P1, D2)*
AL hero+rotator → text-fill thesis paragraph → **The Loop pinned carousel** (6 chapter cards: 01 Adversary invents → 02 Band transmits → 03 Surveillance detects → 04 Debate → 05 Escalate → 06 Codify+regression gate) → count-up proof (`197 tests · 4→5 rules · 0 regressions · <3s codify`) → "Remove Band → desks cannot coordinate" → CTA "Enter the Command Center →".

---

## §4 — WIREFRAMES (ASCII, drop-in reference)

### (b) Live Dashboard — the command center
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [◢ A&O]   LIVE DESK                          ( ● Band: connected )   ( ⟳ connected )        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ STATSBAR  TOTAL CASES │ FLAGGED(red) │ ESCALATED(amber) │ ACTIVE RULES 4▸5◀ │ FP 72% │ 41.2h │
├───────────────────────────────────┬──────────────────────────────────────────────────────┤
│  ┌ DEMO CONTROLS ──────────────┐  │  RULE REGISTRY                                    ◢   │
│  │ (Beat A)(Beat B)(R&D) Running│  │  ID  FAMILY  PROV  STATUS                            │
│  └──────────────────────────────┘  │  SPOOF-001 spoofing seed ●ACTIVE                     │
│   ╔═══════ TOPOLOGY GRAPH ══════╗  │  LAYER-002 layering seed ●ACTIVE                     │
│   ║  R&D DESK │░wall░│ SURV     ║  │  WASH-003 wash_trade seed ●ACTIVE                   │
│   ║ ┌adversary┐                 ║  │  MARK-004 marking seed ●ACTIVE                       │
│   ║ │●done amber│                ║  │  ┌ LAYER-005 layering case#C-0187 ●ACTIVE ✦ ┐ ◀flash│
│   ║ └────┬────┘  ░bridge(grey)░  ║  │  └──────────────────────────────────────────┘       │
│   ║ ┌anomaly┐ ┌investigator┐     ║  │  active rules 4▸5 · ✓ regression gate PASS          │
│   ║ │●active│→│▓WAITING ON  │    ║  ├──────────────────────────────────────────────────────┤
│   ║ └───────┘ │ BAND ◖◗ BLUE│    ║  │ DOSSIER  ⚔Prosecution[gold▸frontier] 🛡Defense[▸open] │
│   ║      recruit↓pulse └──┬──┘    ║  │ "400ms gap=intent"      "gap=bona-fide latency"      │
│   ║ ┌specialist┐         │        ║  ├──────────────────────────────────────────────────────┤
│   ║ └────┬─────┘  ┌proscutn┐⇄┌def┐║  │ LIVE ACTIVITY FEED                        (prepend)  │
│   ║ ┌adjudicator┐ └────────┘ └───┘║  │ ◢ investigator [open] +1.2s ▓waiting on Band▓ ▼      │
│   ║ ┌RULE ENGINE┐←oracle           ║  │ ◢ rule-engine  verdict=FLAG rule=LAYER-002           │
│   ║ │FLAG ●red  │                  ║  │ ◢ prosecution [▸frontier] +3.1s "max-manip…"   ▼     │
│   ║ ┌escalation┐→┌HUMAN ⧗┐amber    ║  └──────────────────────────────────────────────────────┘
│   ╚════════════════════════════════╝                                                        │
├────────────────────────────────────┴──────────────────────────────────────────────────────┤
│ VERDICT TIMELINE  C-0142●PASS  C-0181●FLAG  C-0187 ⧗ESCALATED→●FLAG(flip)  C-0190●PASS  ▶t   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
 MOTION: edges PULSE on handoff · investigator ◖◗ breathes BLUE while recruit round-trips ·
         new rule row flashes · ActiveRules slot-rolls 4▸5 · timeline node FLIPS amber→red · feed fade-up prepend.
```

### (c) Case / Audit Detail — dossiers + HITL + hash-chain
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Live Desk   CASE C-0187   state:▍ESCALATED▏amber                        created 10:23:41   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌FEATURES──────────┐ ┌RESOLVED INPUTS──────┐ ┌VERDICT────────────┐                          │
│ │cancel_to_fill .94 │ │window_ms 400        │ │result ▍FLAG▏ red   │                          │
│ │depth_levels  5    │ │bona_fide_ids [ ]    │ │rule_id LAYER-002   │                          │
│ │self_match    .00  │ │intent "evade"       │ │cited {gap_ms:400}  │                          │
│ └───────────────────┘ └─────────────────────┘ └────────────────────┘                          │
│ DOSSIER CONTEST  ⚔PROSECUTION[gold▸frontier] ⇄ 🛡DEFENSE[graphite▸open]                       │
│ ╔ HITL CONTROLS (only when ESCALATED) ════════════════════════════════════════════════════╗ │
│ ║ ( ✓ CONFIRM — derive rule, run regression gate, codify )  ( ✕ REJECT — close )           ║ │
│ ║   primary frost-fill                                        ghost outline                  ║ │
│ ╚═══════════════════════════════════════════════════════════════════════════════════════════╝ │
│ AUDIT LINEAGE — hash-chained ledger                              verify_chain ✓ green        │
│ 00 anomaly_det surv detect  a3f9…c21  —        0000→8b1e…                                     │
│ 01 investigator surv recruit 7c2d…90a bm_4471  8b1e→4d77…                                     │
│ 02 specialist  surv propose  e10b…44f bm_4472  4d77→c0aa…                                     │
│ 03 rule_engine —    verdict  2210…fae —        c0aa→9f31…                                     │
│ 04 escalation  surv escalate bb87…013 bm_4480  9f31→1ed2… ✓                                   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
 MOTION: drawer slides in (ease-out) · CONFIRM→spinner→badge FLIPS amber→red spring-settle→audit refetch→verify_chain ✓ pulse.
```

*(Wireframes (a) Overview hero, (d) Rule Registry, (e) Replay scrubber are in the design research and will be rendered in the mockup PDF after confirmation.)*

---

## §5 — FEATURE TIERS

### MUST-HAVE (P0 — satisfies FRONTEND_SPEC + judging)
SSE store + EventSource abstraction · TopologyGraph w/ blue Band node · LiveActivityFeed · StatsBar (count-up, Active Rules 4→5) · RuleRegistryPanel (4→5 on codify) · VerdictTimeline (PASS→FLAGGED flip) · DemoControls (Beat A/B/R&D) · HITLControls (Confirm/Reject, optimistic + rollback) · ConnectionStatus + ReplayBanner · ModelBadge (frontier/open).

### HIGH-IMPACT DEMO ADDITIONS (P1 — ✅ ALL LOCKED, built in this presentation-priority order)
> D4 = build all. Order = demo-criticality, so if time runs short we ship top-down and never lose a judging-critical moment.

| Order | Feature | Why this rank (judging) | AL motion that sells it |
|---|---|---|---|
| **1 ⭐ MUST** | **C1. Live codify + regression-gate reveal** | THE money moment; directly proves **Criterion 4** (novel-rule codification + regression safety). Non-negotiable. | new row fade-up+scale; gate ✓ stagger-cascade; StatsBar 4→5 count-up simultaneously |
| **2 ⭐ MUST** | **C2. Band "waiting" pulse + Delete-Band toggle** | Proves **Criterion 1** (Band IS the coordination layer): blue pulse shows live dependency; toggle greys all Band edges → desks freeze. | breathing blue halo loop + edge draw-on; toggle → edges desaturate+freeze |
| **3 ⭐ MUST** | **C4. Audit hash-chain verifier badge** | Proves **Criterion 1/4** integrity: `verify_chain ✓` lights links head→tail. The "tamper-evident" proof. | sequential link illumination → ✓ settle |
| **4** | **C5. Replay scrubber** | Judge-control + **on-stage safety net** if live SSE flakes; scrub recorded case in lockstep. | scrubber as AL toggle; rewind = "Replay the story ↑" |
| **5** | **C3. Adversary ⚔ Surveillance split view** | Visualizes the **Chinese wall** explicitly; strong "wow" but the wall is already implied by lane layout, so ranked last. | wall crossing slides L→R; desks fade in independently |
| **6 (bundled w/ C1)** | Beat-sheet auto-pilot ("Run 90s Demo") | Chains Beat-A→Beat-B→Confirm with timed toast captions — makes the live demo hands-free/repeatable. | captions fade-up per beat |

**If forced to cut for time:** ship 1→2→3 (all three are judging-critical), then 4 (safety net), then 5. Nothing above order 4 is droppable.

### NICE-TO-HAVE (P2)
Per-node click-to-filter · Case search/family filter · Confidence-threshold (τ) slider · Cover/OG + Vercel deploy · Keyboard demo hotkeys (A/B/C) · Sound cue on codify (toggleable).

---

## §6 — NOT DONE YET / NEEDS BACKEND (mock now, wire later)
Every item is mocked behind the EventSource/fetch abstraction → swapping to live is zero-rework.

| Q# | Gap | Mock now | Wire later |
|---|---|---|---|
| **Q6** | `ActivityEvent` has **no `case_id`** (can't attribute frames under concurrency) — *most important* | fixtures carry synthetic `case_id`; store keys by it | backend adds `case_id`; drop shim |
| **Q5** | No structured SSE markers (parse human strings) | `parseMarker()` util → `{stage,event_type}`; fixtures pre-structured | backend adds `stage`/`event_type`; parser pass-through |
| **Q2** | `POST /demo/rnd` route missing | "Run R&D" hits mock emitting `desk=rnd` stream | point at real route |
| **Q3** | `/stats` returns counts only (no FP%, analyst-hrs, alerts) | hard-code narrative tiles; bind active_rules/flagged/escalated live | bind if computed |
| **Q9** | No replay-discovery endpoint | hard-code demo case_id + fixtures list | add `GET /replays` |
| **Q10** | Adversary R&D model-badge alias absent | placeholder alias ("rnd-open") | swap to real alias |
| **Q8** | No `/close` route (FLAGGED→CLOSED) | no Close button | add only if backend exposes |
| **gate** | Confirm returns `regression_passed` bool but no per-detection breakdown | animate fixture list gated by real bool | render real counts if returned |
| **CORS** | not configured | dev proxy / same-origin mock | add CORS before deploy |

---

## §7 — TECH STACK + DATA FLOW (frontend-only now → live SSE later)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (React 19), App Router** | Vercel deploy; reuse prediction-arena SPA |
| Styling | **Tailwind + CSS-variable tokens** + Radix primitives | theme-agnostic (D1 = token swap, not refactor) |
| Topology | **@xyflow/react** | node-graph centerpiece |
| Charts | **Recharts** | timeline; lightweight |
| Motion | **Framer Motion** (reveals/count-ups/flips) + **GSAP ScrollTrigger** *only* on `/how-it-works` | AL pinned-scroll needs scrubbed pinning |
| Live state | **Zustand** | one EventSource writes; many subscribe; no re-render storms |
| REST state | **TanStack Query** | `/cases`,`/rules`,`/stats`,`/audit`; invalidate on SSE markers |
| Fonts | **Aeonik** (fallback Aktiv Grotesk) + **JetBrains/Geist Mono** for hashes/params | AL mandate; mono for all data |

**Swap-proof seam:**
```
EventSourceAdapter (interface)
 ├─ MockAdapter  (replays events-<case_id>.jsonl at timed cadence)   ── DATA_MODE=mock
 └─ LiveSSEAdapter (native EventSource, GET /stream)                 ── DATA_MODE=live
        ▼ writes
   Zustand store  { events[], nodes{}, edges{}, connection }
        ▼ selectors → Topology · Feed · Dossiers · Timeline · Stats(rules)
        ▲ invalidate on markers
   TanStack Query  /cases /rules /stats /audit
```
- One env flag `NEXT_PUBLIC_DATA_MODE = mock | live` selects the adapter; components never know which.
- Fixtures mirror the backend replay format → **mock cadence == real cadence == replay cadence** (one code path).
- Optimistic HITL: mutate store immediately, reconcile on POST 200, rollback on error.
- Theme tokens in `:root` → deferred light/dark (D1) is a token swap.

---

## §8 — MOTION STORYBOARD (maps 1:1 to §1 `--ease-*`/`--dur-*`)

**Moment 1 — Rule Codification + Regression Gate** (≤3s, one screen): CONFIRM→spinner (0) · badge ESCALATED→FLAGGED spring-settle (120) · StatsBar 4▸5 roll (300) · 5th rule card rises, amber border (380) · "✓ regression gate PASS" wipes in (700) · border decays to subtle (900) · feedback edge pulse to R&D (1000).

**Moment 2 — Band "Waiting" Pulse:** Investigator frost→`#3b82f6`, label "▓ waiting on Band ▓" (0) · breathing halo loop ~55bpm (0→∞) · traveling edge pulse Investigator→Specialist every 1.4s (200) · on return → Specialist active, halo collapses, fill blue→emerald · persistent footnote "Remove Band → desks cannot coordinate".

**Moment 3 — Verdict Flip:** node ⧗ESCALATED amber-ring rotate (0) · flip rotateX 0→180° front amber/back red (80) · ring ripple (200) · timeline segment re-shades amber→red clip-wipe (260) · `result=FLAG · rule=LAYER-002` caption fade-up (320) · StatsBar FLAGGED++/ESCALATED-- (400). **reduced-motion:** all degrade to 180ms opacity/color cross-fade; counters snap.

---

## §9 — BUILD ORDER (when we start the actual frontend)
1. EventSource adapter + Zustand store + fixtures
2. StatsBar + LiveActivityFeed (cheapest proof of live)
3. TopologyGraph + blue Band node (centerpiece)
4. RuleRegistry + codify reveal (C1)
5. VerdictTimeline + HITLControls
6. Case Audit drawer + hash-chain verifier (C4)
7. `/how-it-works` scrollytelling (D2)
8. Replay mode + scrubber (C5)
9. Deploy polish (OG, Vercel)

---

## §10 — TRACKER
- [x] Research 4 specs (alpha-ledger weighted) — 6-agent workflow
- [x] Design tokens (AL monochrome + semantic accents)
- [x] Page map + per-page layout
- [x] Wireframes (dashboard, audit) + motion storyboard
- [x] Feature tiers + not-done-yet/backend list + tech stack
- [x] **User confirmed D1–D4 (§0)** — hard light↔dark · /how-it-works in · tone-only desks · all P1 locked
- [x] Folded D-choices into tokens (§1, tone-only desks) + §1b transition system + §5 priority order
- [x] Generated per-page mockup **PDF** → `frontend-design/alpha-oversight-mockups.{html,pdf}` (6 pages, local design vault — not pushed)
- [x] **Scaffolded `alpha-oversight/frontend/`** — Next.js 16.2.9 · React 19 · Tailwind v4 · zustand · @tanstack/react-query · @xyflow/react · recharts · framer-motion · gsap. Build ✓ typecheck ✓ runtime 200 ✓
- [x] §9 step 1 done: design tokens (`app/globals.css`) · types (`lib/types.ts`) · EventSource adapter mock↔live (`lib/eventsource/`) · Zustand store (`lib/store/`) · REST client (`lib/api/`) · fixtures · providers · minimal live-feed proof page
- [ ] §9 step 2→9: StatsBar · TopologyGraph (blue Band node) · RuleRegistry (codify C1) · VerdictTimeline + HITL · Audit drawer (C4) · /how-it-works · Replay (C5) · deploy
