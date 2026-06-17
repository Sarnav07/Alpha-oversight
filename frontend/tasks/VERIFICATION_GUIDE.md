# Alpha & Oversight — Frontend Verification Guide (what changed & where to see it)

A page-by-page, "what you will see on the website" walkthrough of every change, so anyone (no coding required) can open the site and eyeball it. Numbers are system-true: **8 LLM agents + 1 rule engine**, **4 seed rules → 5 codified live**, **100% deterministic verdicts**. The colour `--band-blue` is reserved for "the Band" (the shared medium) only.

**Fresh verification evidence (all green):**
- `tsc --noEmit`: clean, exit 0 — no type errors.
- `npm run build`: exit 0 — Next.js 16.2.9, 13/13 static pages generated.
- `npm run test` (vitest): **65 tests passed across 5 files**, exit 0.
- `.venv/bin/pytest backend/tests/test_ledger.py`: **12 passed in 0.06s**, exit 0.
- Curl + grep against a fresh production build proved the new strings actually ship:
  - FOUND on `/`: `LLMs decide the verdict`, `Your adversary`, `catches the evasion`, `8 agents · 1 rule engine · 2 tiers`, `9 roles = 8 agents`, `>BAND<`, `4 → 5` (KeyFigures middle tile).
  - ABSENT on `/` (good): `94%` — zero occurrences, the fabricated stat is gone.
  - FOUND on `/how-it-works`: `Qwen3.6-35B-A3B`.

---

## How to run it

```bash
cd frontend && npm run dev
# open http://localhost:4100
```

### MOCK mode vs LIVE mode

- **MOCK mode (default — just `npm run dev`).** No backend needed. The desk page auto-plays the **Beat-B fixture** the moment you land on it, so you immediately see a full case flow, the ESCALATED human-in-the-loop controls, the rule registry going `4 → 5`, and the audit ledger. Use this for almost everything below.
- **LIVE mode (needs the backend running).** Start the frontend with:
  ```bash
  NEXT_PUBLIC_DATA_MODE=live NEXT_PUBLIC_API_BASE=http://localhost:8077 npm run dev
  ```
  and in a second terminal run the backend:
  ```bash
  cd .. && .venv/bin/uvicorn alpha_oversight.server.app:create_app --factory --port 8077
  ```
  (Use the same port in `NEXT_PUBLIC_API_BASE` as the uvicorn `--port`.)

> **Important:** Many of the desk's error / empty / connection states are **LIVE-mode only** — they cannot appear in mock mode because mock mode never talks to a backend. Those items are clearly tagged **LIVE-ONLY** below, with how to trigger them (usually: start live, then **kill the backend**).

---

## Landing page ( / )

Open `http://localhost:4100/`. Scroll top to bottom. The changes below are in scroll order.

### 1. Opening splash — "& OVERSIGHT" is now bright *(Preloader.tsx)*
- **What:** The wordmark in the loading splash.
- **Where:** The very first thing on load — the full-screen "ALPHA & OVERSIGHT" splash.
- **Before → After:** The "& OVERSIGHT" half was dim gray (`--text-faint`) → now full frost (`--frost`).
- **How to see it:** Hard-refresh the page and watch the splash. "& OVERSIGHT" is now just as bright as "ALPHA" (the two halves match).

### 2. Hero headline — now a 2-line story *(HeroScroll.tsx)*
- **What:** The big hero headline at the top of the page.
- **Where:** First full screen after the splash.
- **Before → After:** Was "Your adversarial" + one rotating word (Sentinel. / Adversary. / Auditor.) → now **"Your adversary"** on line 1 + a rotating **clause** on line 2 cycling **"catches the evasion." / "invents the attack." / "codifies the rule."** (these map to Beat-A / R&D / Beat-B).
- **How to see it:** Look at the hero. Line 2 cycles through the three phrases on a loop.

### 3. PoweredBy badge now names the rule engine *(PoweredBySection.tsx)*
- **What:** The small badge in the "Powered by / why different" panel.
- **Where:** Scroll down to the powered-by section.
- **Before → After:** "8 agents · 2 tiers" → **"8 agents · 1 rule engine · 2 tiers"**.
- **How to see it:** Read the small badge — it now explicitly names the rule engine.

### 4. "Why" section — first stat is now the thesis *(WhySection.tsx, STATS[0])*
- **What:** The first of the three stat cards in the "Why" section.
- **Where:** Scroll to the "Why" section; it's the first (left-most) stat.
- **Before → After:** Was **"94%" / "Catch the evasion"** (a fabricated compliance number with no provenance) → now **"0" / "LLMs decide the verdict"** (the thesis: LLMs argue, deterministic code decides).
- **How to see it:** First stat reads **0** with the label **"LLMs decide the verdict"**. The old "94%" is gone entirely.

### 5. Overview nonagon — clean "BAND" hub *(OverviewSection.tsx)*
- **What:** The self-drawing nine-sided (nonagon) diagram and its centre hub.
- **Where:** Scroll to the overview section with the animated nonagon.
- **Before → After:** The centre used to stack three lines ("EVERY HAND-OFF" / "THROUGH BAND" / "9 roles · 1 medium · hash-chained") → now a single large **"BAND"** wordmark in band-blue at the centre.
- **How to see it:** The nonagon draws itself and the hub is one clean "BAND" word.

### 6. Overview footnote — reconciles "9 roles" vs "8 agents" *(OverviewSection.tsx)*
- **What:** A new caption line under the nonagon.
- **Where:** Directly below the nonagon, between the existing captions.
- **Before → After:** (new line) → **"9 roles = 8 agents + the rule engine; the human confirms."**
- **How to see it:** A quiet footnote under the nonagon that explains why "Nine roles" and "8 agents" are both correct.

### 7. Key figures — middle tile shows the arrow "4 → 5" *(KeyFigures.tsx)*
- **What:** The three big key-figure tiles.
- **Where:** Scroll to the "key figures" strip (shows 8 / 4→5 / 100%).
- **Before → After:** The middle tile used to count up to "4" → now renders a static **"4 → 5"**. Labels are also bumped to ~13px / 0.08em tracking so they read as larger phrases.
- **How to see it:** Middle tile shows the arrow **"4 → 5"** (not a lone 4); all three labels look a touch larger and more spaced.

### Under the hood (not visually obvious)
These shipped but look identical on screen — they affect performance, accessibility, or screen-reader behaviour, not the visuals:
- **GSAP is lazy-loaded** in the hero scroll, the features carousel, and the powered-by section (`await import("gsap")` inside the effect instead of at module scope). *(HeroScroll.tsx, FeaturesCarousel.tsx, PoweredBySection.tsx.)* Result: faster first paint; the scroll-zoom, pinned carousel, and powered-by animations all behave exactly as before.
- **The satirical "We Use Cookies" card now has the `inert` attribute** *(HeroScroll.tsx, `.hero-cookie`)*. Looks the same, but Tab no longer focuses its Accept/Reject buttons and screen readers skip it.
- **Nonagon `<text>` nodes are now `aria-hidden`** *(OverviewSection.tsx)* — the outer SVG `aria-label` narrates the diagram, so screen readers no longer double-read the labels. (The "BAND" hub is also `aria-hidden`.)

---

## How-it-works page ( /how-it-works )

Open `http://localhost:4100/how-it-works`.

### 8. Agent roster — Defense model id is now authoritative *(AgentRoster.tsx)*
- **What:** The model id in the Defense row of the agent roster.
- **Where:** Scroll to the agent roster table; find the **Defense** row, model column.
- **Before → After:** "Qwen3.6-35B" (truncated) → **"Qwen3.6-35B-A3B"** (full, authoritative).
- **How to see it:** The Defense row's model now reads **Qwen3.6-35B-A3B**.

---

## Desk page ( /desk )

Open `http://localhost:4100/desk`. In **MOCK mode (default)** the Beat-B fixture auto-plays, so the items below are visible right away. The LIVE-ONLY items need the backend (see "How to run it") and usually need you to **kill the backend** to see the failure states.

### Visible in MOCK mode (default `npm run dev`)

#### 9. Audit drawer — keyboard-trapped, Escape-to-close, loading skeleton *(AuditDrawer.tsx)*
- **What:** The slide-over audit ledger on the right.
- **Where:** Open the audit drawer (the slide-over on the right of the desk).
- **How to trigger / see it:** Open the drawer, then press **Tab** repeatedly — focus stays *inside* the drawer and cycles. Press **Escape** — it closes and focus returns to where you were. (`aria-modal="true"` + a hand-rolled focus trap.) In live mode you also briefly see a **"loading ledger…"** skeleton before the ledger renders, instead of a flash of the C-0187 fixture.

#### 10. Rule Registry header — dynamic, not hardcoded *(RuleRegistryPanel.tsx)*
- **What:** The Rule Registry panel header.
- **Where:** The rule registry panel on the desk.
- **Before → After:** Was a hardcoded "4 → 5" → now dynamic `{rules.length-1} → {rules.length}`.
- **How to see it:** At 4 rules it reads **"4 → 5"**; once a 5th rule codifies it updates to **"5 → 6"** (the header tracks the real rule count).

#### 11. Human-in-the-loop Confirm / Reject *(HITLControls.tsx)*
- **What:** The Confirm / Reject controls on an ESCALATED case.
- **Where:** When the desk reaches an **ESCALATED** case (the Beat-B fixture does this automatically in mock mode), the Confirm/Reject buttons appear.
- **How to see it (mock):** Click **Confirm** or **Reject** — on success it flips to a "codified / closed" label. (The inline error path is LIVE-ONLY — see item 17.)

#### 12. Reduced-motion respected on the co-evolution ladder *(HighImpact.tsx / CoEvolutionLadder)*
- **What:** The co-evolution ladder's slide-in animation.
- **Where:** The co-evolution ladder section of the desk.
- **How to trigger:** Turn on your OS "reduce motion" setting, reload. The ladder rungs now **appear instantly** (no slide-in), gated by `useReducedMotion`.

### LIVE mode only

> **Tip for the backend-down states (items 13–15):** start in **LIVE mode** with the backend running, let the desk connect, then **stop the uvicorn process** (Ctrl-C in its terminal). The desk should flip to its error/unavailable states. Restart uvicorn and it recovers.

#### 13. Error banner when the backend is down *(ErrorBanner.tsx — NEW)* — **LIVE-ONLY**
- **What:** A thin red (`--verdict-flag`) banner across the top of the desk.
- **Where:** Top of the desk page.
- **How to trigger:** In live mode, kill the backend. The banner appears: **"Backend unreachable — retrying. Showing last known state."** It slides away when the backend recovers. (Shown only when `connection === "error"`.)

#### 14. Connection escalates to "error" instead of looping forever *(adapter.ts / LiveSSEAdapter)* — **LIVE-ONLY**
- **What:** The connection state machine.
- **Where:** Internal, surfaced via the banner + pill.
- **Before → After:** A dead backend used to show an amber "reconnecting" **forever** → now it escalates to **"error"** after persistent failure (≥3 consecutive `onerror`, OR readyState CLOSED, OR a 6-second dead-on-connect timer).
- **How to trigger:** Kill the backend in live mode — the desk flips to the error state (banner of item 13 + the pill of item 15) instead of amber "reconnecting" indefinitely.

#### 15. Connection pill relabeled "backend down" *(ConnectionStatus.tsx)* — **LIVE-ONLY**
- **What:** The small connection pill.
- **Where:** On the desk, near the top.
- **Before → After:** On a real outage the pill now shows a red **"backend down"** instead of amber "reconnecting".
- **How to trigger:** Kill the backend in live mode; watch the pill turn red and read **"backend down"**.

#### 16. Stats bar shows "—" / "unavailable" on failure *(StatsBar.tsx)* — **LIVE-ONLY**
- **What:** The stat tiles at the top of the desk.
- **Where:** The stats bar.
- **Before → After:** A failed `GET /stats` or `/rules` used to show silent zeros → now shows a red **"—"** and the label dims to **"unavailable"**.
- **How to trigger:** Kill the backend in live mode; the tiles read **"—" / "unavailable"** rather than 0. (Backed by `statsError` / `rulesError` exposed from `model.ts` — item 23.)

#### 17. Inline error reasons on Confirm / Reject failure *(HITLControls.tsx)* — **LIVE-ONLY (error path)**
- **What:** An inline red `role="alert"` reason under the Confirm/Reject buttons.
- **Where:** Under the HITL controls on an ESCALATED case.
- **How to trigger:** In live mode, when a confirm/reject call fails, the buttons only flip to success on a real 2xx; on failure an inline red reason appears, mapped from the HTTP status:
  - **422** → "regression gate failed — rule not codified"
  - **409** → "case no longer awaiting review"
  - **404** → "case not found"
  Buttons also get `aria-busy` while pending. (Errors are rethrown as a `DeskActionError` carrying `.status` from `controller.ts` — item 24.)

#### 18. "Click a demo to begin." idle overlay *(LiveCommandCenter.tsx)* — **LIVE-ONLY**
- **What:** A centered hint overlay on an idle, connected desk.
- **Where:** Center of the desk.
- **How to trigger:** In live mode, once connected but before any event arrives (`live && connection === "connected" && events.length === 0`), you see **"Click a demo to begin."** It disappears on the first event.

#### 19. One persistent /stream connection across beats *(useTraceStore.ts)* — **LIVE-ONLY**
- **What:** The EventSource lifecycle.
- **Where:** Browser **Network** tab.
- **How to trigger:** In live mode, open the Network tab and run Beat A then Beat B. There is a **single `/stream` connection** that persists (no per-beat abort+reopen), thanks to an `if (adapter) return` no-op guard in `connect()`.

#### 20. Clean 4 → 5 with no flicker on confirm *(queries.ts / useInvalidateOnMarkers)* — **LIVE-ONLY**
- **What:** The Active Rules tile animation after a codify.
- **Where:** The Active Rules stat tile.
- **How to trigger:** On a live confirm, the codify marker now **debounces** its `/rules` + `/stats` refetch by ~500ms, so Active Rules animates **4 → 5 cleanly** instead of flickering 5 → 4 → 5.

### Under the hood — desk (not visually obvious)
- **`model.ts`** — `DeskModelView` exposes `statsError` / `rulesError` (feeds the StatsBar in item 16). "WORKING STUB" header stripped. *(Internal.)*
- **`controller.ts`** — `confirm()` / `reject()` rethrow a `DeskActionError` carrying the HTTP `.status` (drives item 17). `codifyTail` is kept (it's live in the mock path). "WORKING STUB" header stripped. *(Internal.)*
- **`parseMarker.ts`** — a **DEV-only** `console.warn` fires when a "pipeline" frame yields no recognised marker (guarded by `NODE_ENV !== "production"`; never alters output). To see it: run dev, open the **dev console** — a loud warning appears only if the backend marker grammar drifts.

---

## Tests you can run

**Frontend (65 tests across 5 files):**
```bash
cd frontend && npm run test
```
Vitest is configured with two projects: **node** (parseMarker — 31 tests, useTraceStore, LiveSSEAdapter) and **jsdom** (useDeskModel, HITLControls). Expect **5 files / 65 tests passed**.

**Backend ledger concurrency:**
```bash
cd .. && .venv/bin/pytest backend/tests/test_ledger.py
```
`ledger.py`'s `append()` is now wrapped in a `threading.Lock` and chains off the live in-memory `_head`, so concurrent cases cannot fork `prev_hash` (no false `verify_chain ✗`). The new concurrency test runs 4 cases × 25 interleaved appends and asserts `verify_chain` is True. Expect **12 passed**.

---

## Not changed (so you know what NOT to look for)

**Deferred to the upcoming /desk redesign** (the desk visuals are intentionally slated for rework, so these were not done):
- Per-frame re-derive perf optimisation.
- Chinese-wall vertical divide on the desk.
- Full-panel codify-flash.
- Topology keyboard reachability.
- NodeTrace / useFilteredEvents virtualization.
- Model-tier corner badges.
- Nav "Band: connected" blips.

**Skipped (user decision):**
- Replay "demo mode" UI. The capability already exists in the backend — `GET /stream?replay=<case_id>` works and can be triggered manually — so no new UI was added for it.
