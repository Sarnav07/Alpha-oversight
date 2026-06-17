# "How it works" - restructure & content improvements

**Status:** content/design doc - *no code changes here*. This is the plan for turning the
current `/how-it-works` page into a structured, readable explanation a newcomer can follow.

**Companion deliverable:** a 5-page report, `report/main.tex` → compiled to
`frontend/public/alpha-oversight-report.pdf`, with six hand-drawn figures. The page's hero
also reuses one of those figures: `frontend/public/architecture.png` (and `.svg`).

---

## 1. Why this doc

The current page looks great but reads as a string of slogans ("The adversary invents. / The
system learns."). The animations are excellent; the *words* are thin and out of order, so a
visitor who wants to actually understand the project never gets a structured explanation.

The fix is to keep every animation and re-hang the **copy** on a clear spine - the same spine
as the report:

> **Motivation → Overview → Methodology → Project structure → What makes it different → See it live**

Each section gets a short, plain-language paragraph (the report is the long version, linked at
the top and bottom). The visual for each section already exists in the codebase; this doc maps
copy → component so nothing has to be rebuilt.

---

## 2. New structure at a glance

| # | Section | New copy (below) | Renders with (existing component) | Asset |
|---|---------|------------------|-----------------------------------|-------|
| 0 | **Hero** | keep, tighten sub-line | `components/how-it-works/HowItWorksHero.tsx` | - |
| 1 | **Motivation** | §3.1 | new short text block *or* reuse the intro slot in `HowItWorksHero` / top of `PipelineFlow` | - |
| 2 | **Overview** | §3.2 | new text + **architecture image**; `TwoDesks` in `StorySections.tsx` follows | `public/architecture.png` (Fig 1) |
| 3 | **Methodology** (5 sub-flows) | §3.3 | `PipelineFlow.tsx`, `AgentRoster.tsx`, `FourDetectors`, `EvasionStory.tsx`, `DeterministicClose`, `TopologyGraph.tsx`, `HighImpact.tsx`, `AuditDrawer.tsx` | report figures (optional inline) |
| 4 | **Project structure** | §3.4 | new compact section (table or stacked rows) | - |
| 5 | **What makes it different** | §3.5 | reuse `DeterministicClose` + a new "key features" block | - |
| 6 | **See it live** | §3.6 | `ClosingCTA.tsx` + a **"Read the report"** link | `public/alpha-oversight-report.pdf` |

Keep the existing scroll/section rhythm (light backbone, dark nested stage for `EvasionStory`).
The only structural change is **adding two short prose sections (Motivation, Project structure)**
and **re-labeling the existing ones** so the order reads as a story.

---

## 3. Ready-to-use copy

Paste-ready. Written to be simple and connected; keep the two-tone heading style the page
already uses (ink line + faint line).

### 3.1 Motivation

> **Heading:** Why this exists
>
> Markets can be rigged. A trader can post orders they never plan to fill to fake demand
> (spoofing), stack fake depth across price levels (layering), trade with themselves to invent
> volume (wash trading), or push the closing price to mark their own book. Regulators write
> rules against each of these, but the rules are fixed while the tactics keep moving - a small
> change to a known trick can slip a rule written for last year's version of it.
>
> Two obvious fixes both fall short. Writing new rules by hand is slow and always a step behind.
> Letting an AI model decide the verdict is worse: the decision becomes a black box a regulator
> can't audit and an opponent can try to talk its way past. Alpha & Oversight keeps the verdict
> deterministic and auditable, and lets the system write its own new rules the moment an old one
> is beaten.

*Component:* a new short text block at the very top of the story (before `PipelineFlow`), or
fold into the `HowItWorksHero` sub-headline area. No animation needed; a `Reveal` fade is plenty.

### 3.2 Overview

> **Heading:** The whole picture
>
> The system is built from two desks that never share a model or a memory. They talk only
> through Band, a message bus that carries every handoff. The **R&D desk** is the red team: one
> Adversary that invents new evasions. The **Surveillance desk** is the blue team: seven agents
> that investigate a case, plus one rule engine that is not an agent at all. The rule engine is
> plain code, and it is the only thing that decides PASS or FLAG.
>
> Order flow crosses a one-way wall: only the bare orders move from R&D to Surveillance, with
> the adversary's reasoning and model identity stripped off first. Every message is sealed into
> a hash-chained ledger, so the whole decision can be replayed and checked.

*Component / asset:* drop the **architecture image** (`public/architecture.png`, the report's
Fig 1) right here as a full-width figure - it's the same hero you can use on the landing page.
The existing `TwoDesks` block in `StorySections.tsx` then expands on the red/blue split.

### 3.3 Methodology (five short sub-flows)

Re-use the existing animations; give each a one-paragraph lead-in so the reader knows what they
are looking at. Order matters - this is the "follow one case" arc.

**(a) Following one case, end to end** - *renders with `PipelineFlow.tsx` + `AgentRoster.tsx`*

> A case moves down a line of agents that never call each other directly - each drops its work
> on Band and the next picks it up. The Anomaly Detector computes hard features (cancel-to-fill,
> book depth, self-match) and decides if the flow looks suspicious. The Investigator recruits the
> right Specialist by those features, not by a guess. The Specialist proposes the contested
> inputs the engine can't derive - the time window, the bona-fide orders, the intent. Prosecution
> and Defense then argue the case locally, off Band, and the Adjudicator settles their numbers.

**(b) Inventing a new evasion** - *new text; pairs with the R&D side of `TwoDesks` and the
"two referees" note already in `AgentRoster.tsx`*

> A new tactic is never used until it proves itself twice. The Adversary proposes an order
> sequence, and two deterministic referees gate it: the real rule engine must miss it (it
> evades), and a backtest must show it makes money and moves the price (it's real). Only a
> sequence that evades *and* profits crosses the wall.

**(c) Who decides the verdict** - *renders with `DeterministicClose` in `StorySections.tsx`*

> The verdict is never an opinion. The engine takes the order events, the inputs the debate
> resolved, and the active rules, then runs each rule's math. The first rule that trips returns a
> FLAG with the rule id and the exact metric that crossed the line; if none trip, the case
> passes. The agents only shape the contested inputs. The engine alone turns them into PASS or
> FLAG, the same way every time.

> Keep the four seed detectors here too (`FourDetectors`): spoofing & layering (FINRA 5210),
> wash & marking (SEC 10b-5), each with its cited metric and threshold.

**(d) Closing the loop** - *renders with `EvasionStory.tsx` (the centerpiece) + `HighImpact.tsx`
(the 4→5 ladder)*

> Here is the part that makes it self-improving. When the Adversary's novel evasion reaches the
> engine, the seed rules miss it and the case passes - but because the flow still looked
> suspicious, it escalates to a human instead of closing. A compliance officer confirms it really
> is manipulation, and that one click does the rest: a new rule is derived from the case,
> replayed through a regression gate to prove it now flags, and codified. Active rules go from
> four to five, and the case flips from PASS to FLAGGED. The Adversary has to invent something new.

**(e) Why you can trust it** - *renders with `AuditDrawer.tsx` (hash chain) + the wall callout*

> Two things carry the trust. The wall (the SanitizedBridge) strips the adversary's reasoning and
> model identity before any order crosses, so the blue team can't be coached. The ledger seals
> every Band message into a hash chain - each entry's hash is built from the previous hash plus
> the message body, and binds the real Band message id. Change one byte and the chain breaks, so
> `verify_chain()` returns false. The decision isn't just recorded; it's tamper-evident.

*Optional:* the report figures (`report/figures/0X-*.pdf`, also exportable to PNG/SVG via
`report/build.sh`) can be embedded inline next to (a)-(e) for readers who prefer a diagram to the
live animation. Not required - the live components already cover these.

### 3.4 Project structure (new, short)

> **Heading:** How the code is organized
>
> The backend keeps the deterministic core apart from the agents that feed it. The rule engine,
> the per-family math, and the rule registry live in `rules/`. The agents and their specialist
> registry live in `agents/`. Band transport and the SanitizedBridge wall live in `band/`. The
> hash-chained ledger lives in `audit/`, the case state machine in `state/`, and the FastAPI
> server (SSE stream, case endpoints, demo triggers) in `server/`. Every flag can be traced from
> a Band message all the way to a cited rule.

*Component:* a compact stacked list or two-column table; `Reveal` stagger. (This mirrors the
report's project-structure table.)

### 3.5 What makes it different

> **Heading:** What's actually new
>
> - **The code decides, not a model.** The rule engine is the only authority for PASS or FLAG.
> - **The rulebook co-evolves.** A confirmed miss becomes a regression-tested rule in one step.
> - **The wall is structural.** Two separate Band identities; the crossing strips reasoning and
>   model identity. Isolation by construction, not policy.
> - **The audit binds real messages.** The hash chain ties each step to a real Band message id.
> - **Different model families guard each other.** The four seats on an adversarial boundary run
>   four different model families, so a blind spot in one can't quietly pass to the next.
> - **Both gates are deterministic.** A new evasion must beat the real engine *and* profit in a
>   backtest. Neither test is an LLM.

*Component:* reuse `DeterministicClose` for the thesis line, then a 2×3 feature grid (the page
already has card grids in the showcase sections to copy the style from).

### 3.6 See it live (closing)

> Keep `ClosingCTA.tsx` ("Now watch it run live" → `/desk"). **Add a secondary link:**
> "Read the full report (PDF)" → `/alpha-oversight-report.pdf`.

---

## 4. Stale-content fixes (do these regardless of the restructure)

The page currently shows the **Phase-7 live-run** model line-up. The backend's current matrix
(`.env` + `docs/MODEL_ASSIGNMENTS.md`, 2026-06-17) is different, and it's what powers the
"model-family diversity" feature in §3.5. If the page should match the current backend, update
the labels in `components/how-it-works/AgentRoster.tsx`:

| Seat | Page shows now | Current backend matrix |
|------|----------------|------------------------|
| Adversary | `Qwen3-Next-80B` (open) | **`claude-opus-4-8`** - Anthropic, frontier |
| Prosecution | `claude-sonnet-4-6` | **`Kimi-K2.7`** - Moonshot |
| Defense | `Qwen3.6-35B-A3B` | **`DeepSeek-V4-Pro`** - DeepSeek |
| Adjudicator | (open, unlabeled) | **`GLM-5.2`** - Zhipu |
| Escalation Manager | `gpt-5-mini` | **`Qwen3.5-397B`** - Qwen |
| Anomaly / Investigator / Specialist | `Qwen3-Next-80B` | `Qwen3-Next-80B` - Qwen *(unchanged)* |
| Rule engine | deterministic | deterministic *(unchanged)* |

Decision rule: **make the labels match whatever you'll actually run in the demo.** If you demo on
the new matrix, update them and lean into the "four distinct families" story (it's a real
differentiator now). If you demo on the Phase-7 line-up, leave them. Don't show one and run the
other - that's the kind of drift the repo's CLAUDE.md warns about.

Two more small truth-checks (already correct on the page, listed so they don't regress):
- **Rules grow 4 → 5**, not 3 → 4. (`EvasionStory` and `HighImpact` already say 4→5.)
- **8 agents + 1 rule engine**; the rule engine is *not* an agent.

---

## 5. What to keep vs. change

**Keep (no work):** every animation - `EvasionStory`, `TopologyGraph`, `VerdictTimeline`,
`AuditDrawer`, `HighImpact`, `PipelineFlow`, the reduced-motion fallbacks, the band-blue rule,
the light/dark section rhythm.

**Change (content only):**
1. Add a **Motivation** text block at the top (§3.1).
2. Add the **architecture image** + an **Overview** paragraph (§3.2) before `TwoDesks`.
3. Add a one-paragraph **lead-in** above each existing methodology animation (§3.3 a-e) so the
   reader knows what they're watching.
4. Add a short **Project structure** section (§3.4).
5. Reframe the closing into **What makes it different** + the existing CTA, and add the
   **"Read the report"** PDF link (§3.5-3.6).
6. Apply the **model-label fix** (§4) if demoing on the new matrix.

**Net effect:** same look and motion, but now anyone landing cold reads a clean
Motivation → Overview → How → Structure → Why-it's-different story, with the report one click away
for the full version.

---

## 6. Asset checklist (already produced)

- `frontend/public/alpha-oversight-report.pdf` - the linked report (§3.6).
- `frontend/public/architecture.png` / `architecture.svg` - Fig 1 hero (§3.2 + landing page).
- `report/figures/01..06-*.drawio` (+ rendered `.pdf`) - source diagrams, editable in draw.io,
  re-render with `report/build.sh`. Optional inline use in §3.3.
