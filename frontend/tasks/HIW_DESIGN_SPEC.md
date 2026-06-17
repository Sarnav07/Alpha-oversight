# `/how-it-works` rebuild — DESIGN SPEC (build contract for parallel agents)

This is the single source of truth for the from-scratch rebuild of `/how-it-works`.
Every diagram + section component is built against THIS file. Read it fully, plus
the two foundation files it references:

- **The diagram kit** — `components/how-it-works/diagram/kit.tsx` (the primitives you build on).
- **The exemplar** — `components/how-it-works/diagram/ArchitectureDiagram.tsx` (D1, already
  built; copy its idioms — local helpers, token usage, layout discipline).

The aesthetic skill in force is **frontend-design** (bold, distinctive, production-grade,
never generic). This page's chosen direction is a **forensic operations room** (below).

---

## 0. Hard rules (violating any of these fails review)

1. **band-blue (`var(--band-blue)` / `#3b82f6`) is SACRED.** It means "on Band / waiting"
   and nothing else. Only `tone="band"` edges and `BandPulse` dots use it. Never decorative,
   never a heading color, never a generic accent. (The kit enforces this — don't fight it.)
2. **Verdict colors keep their meaning:** pass = emerald (`--verdict-pass`), flag = red
   (`--verdict-flag`), escalate = amber (`--verdict-escalate`). Never repurpose them.
3. **The rule engine is the ONE gold-ringed authority** (`EngineNode`, `--tier-frontier`).
   It is NOT an agent. Nothing else is gold.
4. **System facts are frozen — never fabricate or regress them:**
   - **8 LLM agents + 1 deterministic rule engine** (engine = plain code, not an agent).
   - **Two desks, one Chinese wall.** R&D = 1 agent (Adversary). Surveillance = 7
     (Anomaly Detector, Investigator, Specialist, Prosecution, Defense, Adjudicator,
     Escalation Manager).
   - **Band = transport-of-record**, 5 kinds: `HANDOFF · EVIDENCE · VERDICT · ESCALATION ·
     RULE_CODIFIED`. The Prosecution⚔Defense debate is **local, off Band**.
   - **4 seed rules** → co-evolution makes it **5** (always "4 → 5", never "3 → 4").
     Spoofing `cancel_ratio ≥ 0.8` · layering `depth_levels ≥ 3` · wash `self_match_ratio
     > 0.5` · marking `eod_print_move_bps ≥ 100`. (FINRA 5210 = spoofing+layering;
     SEC 10b-5 = wash+marking.)
   - **LLMs argue; code decides.** Agents only set contested inputs (time window, bona-fide
     orders, intent); the engine renders PASS/FLAG.
   - **SanitizedBridge** = the wall: only bare order events cross R&D→Surv; reasoning +
     model identity stripped. Rulebook flows back read-only.
   - **Hash-chained ledger:** `hashₙ = sha256(prev_hash + canonical body)`, binds the real
     `band_message_id`; tamper → `verify_chain() = false`.
   - **NEVER fabricate** alert counts, FP %, analyst-hours, latency SLAs, or test counts.
5. **Page-scoped only.** Everything you build renders under `[data-surface="ops"]` (set on
   the page root by integration). Do NOT touch `app/layout.tsx`, `app/globals.css` tokens,
   the landing page, or any other route. The bolder fonts/texture must not leak.
6. **Next.js 16.2.9 / React 19 / framer-motion 12.** Every component that animates is a
   client component (`"use client"` first line) and has a **`useReducedMotion` fallback**
   that renders the final state instantly. (The kit already does this for you — inherit it.)
7. **No hard-coded hex** inside components. Use the CSS tokens (`var(--…)`). The ONE
   exception is the sticky header (token gotcha — see §9, HiwHeader).
8. **framer-motion `ease` must be the 4-tuple** `EASE` exported from the kit
   (`[0.16, 1, 0.3, 1] as [number, number, number, number]`). A bare array fails tsc.

---

## 1. Aesthetic direction — "forensic operations room"

A premium surveillance-desk feel: dark, cinematic diagram/story stages cut into a calm
light editorial backbone (the existing `data-section` light/dark rhythm). Think *evidence
board meets trading terminal* — editorial seriousness, not dashboard clutter.

- **Display type = Fraunces** (high-contrast editorial serif), via the `.font-display`
  utility. Big, confident, optical-sized headlines. This is the page's signature.
- **Data/labels/eyebrows = Geist Mono** (`font-mono`). All SVG text, eyebrows, metrics,
  rule ids, model ids, captions. Keeps the terminal/forensic register.
- **Body = Geist Sans** (default `font-sans`). Readable paragraphs.
- **Texture:** faint band-blue blueprint grid (`.ops-grid` + `.ops-grid-fade`) and film
  grain (`.ops-grain`) on dark stages; band-blue glow (`.ops-glow-band`) ONLY on genuine
  on-Band elements; section seams (`.ops-seam`).
- **Motion:** diagrams self-draw on scroll-in (the kit's `TracePath`); band-blue pulses
  ride Band edges; verdict chips fade in. Cinematic but restrained. Reduced-motion =
  everything in final state, no pulses.

**Heading idiom (keep the AlphaLedger two-tone):** a mono eyebrow (uppercase, tracked,
`text-[color:var(--text-muted)]`) above a large two-tone `.font-display` headline — first
line `text-[color:var(--text-primary)]`, continuation line `text-[color:var(--text-faint)]`.
Example:
```tsx
<p className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Overview</p>
<h2 className="font-display text-4xl sm:text-5xl leading-[1.05]">
  <span className="text-[color:var(--text-primary)]">The whole picture</span>{" "}
  <span className="text-[color:var(--text-faint)]">— two desks, one wall.</span>
</h2>
```

---

## 2. Theming & scope mechanics

- The page root carries `data-surface="ops"` (integration sets it). All your `.font-display`
  / `.ops-*` utilities only resolve under it — you don't need to add the attribute yourself.
- **Light vs dark stages:** the page backbone is `data-section="light"` (white theme). A
  **dark** stage (e.g. a diagram on obsidian) MUST be wrapped in an element tagged
  `data-section="dark"` so frost text + tokens resolve correctly (token gotcha — a dark panel
  inside a light page otherwise inherits near-black inks). Pattern for a dark stage:
  ```tsx
  <div data-section="dark" className="ops-grain bg-[var(--obsidian)] ...">
    <div className="ops-grid ops-grid-fade absolute inset-0" aria-hidden />
    {/* diagram / content */}
  </div>
  ```
- Diagrams (kit-built) are theme-agnostic — they read tokens. Place D1/D3/D4/D6 inside a
  `data-section="dark"` stage for the cinematic look (D1 exemplar shows this).
- Tokens you'll use most: `--text-primary --text-body --text-muted --text-faint`
  `--bg-card --bg-inset --obsidian --frost` `--border-subtle --border-default`
  `--band-blue --verdict-pass/flag/escalate --tier-frontier --desk-rnd --desk-surv`.

---

## 3. The diagram kit API (`diagram/kit.tsx`) — full reference

All diagrams import from `./kit`. Never re-implement a primitive that exists here.

- `EASE` — the 4-tuple. Use for every framer-motion `ease`.
- `type Pt = { x; y }`, `type Tone = "band"|"rnd"|"surv"|"engine"|"flag"|"pass"|"escalate"|"human"|"neutral"`.
- `TONE: Record<Tone,string>` — tone → CSS-var color.
- **`DiagramFrame({ viewBox, label, className?, amount?, children })`** — the wrapper. `children`
  is a **render-prop** `(show, reduce) => ReactNode`. It owns the ref + `useInView` +
  `useReducedMotion` and emits `<svg viewBox role="img" aria-label={label}>` with arrowhead
  defs already injected. **Every diagram returns a single `DiagramFrame`.** `show` becomes true
  when scrolled into view (or immediately under reduced motion); pass `show`/`reduce` down to
  every primitive.
- **`TracePath({ d, tone?, width?, dashed?, opacity?, delay?, duration?, arrow?, show, reduce })`**
  — self-drawing path. The core idiom.
- **`edgePath(from, to, mode?)`** — orthogonal path string. `mode`: `"straight"|"hv"|"vh"|
  "mid-h"|"mid-v"` (default `"mid-h"`).
- **`Edge({ from, to, mode?, tone?, label?, dashed?, width?, delay?, pulse?, show, reduce })`** —
  a `TracePath` + arrowhead + optional mono `label` + optional `BandPulse` (only when
  `pulse && tone==="band"`). Use this for most connections.
- **`BandPulse({ path, show, reduce, dur? })`** — band-blue dot riding `path` (the sacred
  on-Band cue). Renders nothing under reduced motion.
- **`Node({ x, y, w, h, title, sub?, tone?, delay?, show, reduce, titleMono? })`** — a card with
  a tone left-bar. Default `tone="surv"`.
- **`EngineNode({ x, y, w, h, title?, sub?, delay?, show, reduce })`** — the gold-ringed obsidian
  authority node. The ONLY gold node. Defaults: title `"RULE ENGINE"`, sub
  `"sole PASS / FLAG authority · deterministic"`.
- **`Diamond({ cx, cy, rw, rh, title, sub?, tone?, delay?, show, reduce })`** — a decision
  diamond (oracle / branch).
- **`Chip({ x, y, w, h?, label, tone?, delay?, show, reduce })`** — a verdict/status pill.
- **`Tag({ x, y, text, tone?, anchor?, delay?, show, reduce })`** — a free SVG caption.

**Authoring conventions (match D1):** define layout constants up front; build small local
helpers for repeated composite shapes (D1 has a `DeskFrame`); stagger `delay` so the diagram
draws in a legible reading order (spine → nodes → edges → chips → tags); keep `viewBox`
generous (D1 = `0 0 1200 612`); all text via kit primitives or `font-mono` SVG `<text>`.

---

## 4. Native diagram components to BUILD

Each is a self-contained `"use client"` component, **default + named export**, file under
`components/how-it-works/diagram/`. Faithful to the named report figure (content below is
extracted verbatim from the figure source — use these exact entities/labels). D1 is done.

### D2 — `CaseRelayDiagram.tsx`  (Fig 2 — "following one case, end to end")
A left→right relay across three numbered phases. Agents never call each other — each drops
work on Band, the next picks it up.
- **Phase 1 · Triage:** `Anomaly Detector` (computes features; flags suspicious flow) →
  `Investigator` (recruits the right specialist; edge label `@mention recruit`) →
  `Specialist` (proposes contested inputs: window · bona-fide orders · intent). Input edge from
  `Sanitized order events` into Anomaly Detector — tone `band`, label `HANDOFF`, **pulse**.
- **Phase 2 · Debate & resolve** (a bordered box labeled `local debate — off Band`, NOT on
  Band): `Prosecution` vs. `Defense` → `Adjudicator` (resolves one conservative set of engine
  inputs). The Specialist→debate edge carries `EVIDENCE` (band tone). Debate→Adjudicator edges
  are `neutral` (local, not Band).
- **Phase 3 · Verdict:** `EngineNode` (runs the active rules — same inputs, same answer) →
  `FLAG · rule_id + cited metric → case FLAGGED` (`Chip` tone `flag`) → `Escalation Manager`
  (packages the brief, recommends an action). Adjudicator→Engine edge label `resolved inputs`;
  Engine→verdict is internal; verdict out is `VERDICT` (band tone, pulse).
- Tones: surveillance agents `surv`; Adjudicator `surv`; debate box border `neutral`; engine
  gold; band edges only for the three real Band messages (HANDOFF in, EVIDENCE, VERDICT).
- viewBox suggestion `0 0 1200 520`.

### D3 — `OracleLoopDiagram.tsx`  (Fig 3 — "inventing a new evasion")
The R&D two-oracle gate. A tactic is never used until it proves itself twice.
- `Adversary` (`Node` tone `rnd`, sub "proposes an order-event sequence engineered to beat the
  live rulebook") → emits `candidate`.
- **Oracle 1 — Rule engine** (`Diamond`, "did it EVADE? (registry returns PASS)").
- **Oracle 2 — Backtest** (`Diamond`, "profit AND price impact?").
- `Confirmed novel evasion` (`Node` / strong card, tone `pass`, "evades AND profits") →
  `→ SanitizedBridge → Surveillance Desk` with edge `HANDOFF · events only` (tone `band`, pulse).
- **Two retry loops** back to the Adversary (tone `flag`/`escalate`, dashed, arrowed):
  Oracle 1 fail = `rule fired → retry (round++)`; Oracle 2 fail = `no profit → retry`.
  Pass labels on the forward edges: `evades ✓` (Oracle1→Oracle2), `real ✓` (Oracle2→confirmed).
- Footer `Tag`: "Bounded: at most K rounds. A round with no evade-and-profit sequence stops the
  loop with no confirmed evasion."
- viewBox suggestion `0 0 1100 560`.

### D4 — `VerdictDiagram.tsx`  (Fig 4 — "who decides the verdict")
The deterministic engine. LLMs set inputs; code decides.
- Three inputs feed the engine (left column `Node`s):
  `Order events` (neutral) · `Resolved inputs` (sub "window_ms · bona-fide ids · intent — the
  only values the LLM debate sets", tone `surv`) · `Active rules (registry)` (neutral).
- A process block (`Node`, wide, tone `engine` styling via EngineNode is overkill here — use a
  bordered `Node` neutral OR a labeled rect): "For each active rule, in order: run the family
  metric — spoofing · layering · wash · marking — overlay the resolved window — first rule that
  trips wins —".
- `any rule trips?` (`Diamond` neutral) → `yes` → `FLAG · rule_id + cited metric` (`Chip`/`Node`
  tone `flag`); `no` → `PASS · no rule fired` (`Chip`/`Node` tone `pass`).
- Footer `Tag` (the thesis): "The models only set the contested inputs. The rule engine renders
  PASS / FLAG deterministically — same inputs, same answer, every time. No LLM overrules it."
- Use the real `EngineNode` somewhere as the decision authority anchor (it's the engine doing
  the deciding) — your call on placement; keep ONE gold node.
- viewBox suggestion `0 0 1100 560`.

### D6 — `TrustDiagram.tsx`  (Fig 6 — "why you can trust it")
Two trust mechanisms side by side: the wall (left) and the hash chain (right).
- **Left — Chinese wall · SanitizedBridge:**
  `R&D order` (`Node` tone `rnd`, sub "symbol · side · qty · limit_price · timestamps  +
  reasoning  + model_key") → `SanitizedBridge` (`Node` neutral, "strips reasoning + model_key",
  edge label `events only`, tone `band`, pulse) → `Surveillance receives` (`Node` tone `surv`,
  sub "symbol · side · qty · limit_price · timestamps (only the bare order)").
  A small back-edge: `active rulebook (read-only)` flowing back to R&D (dashed, neutral).
- **Right — Hash-chained audit ledger** (a vertical stack of three leaves, each a `Node`/rect,
  mono):
  `leaf 1 · HANDOFF   content_sha256 · band_message_id   prev_hash = none   hash = h1`
  `leaf 2 · EVIDENCE  content_sha256 · band_message_id   prev_hash = h1     hash = h2`
  `leaf 3 · VERDICT   content_sha256 · band_message_id   prev_hash = h2     hash = h3`
  Each leaf links to the next (neutral edge). Caption above: `hash = sha256(prev_hash +
  canonical body)`. Footer `Tag` tone `flag`: "tamper any byte → recomputed hash ≠ stored hash
  → verify_chain() = False".
- viewBox suggestion `0 0 1200 600`.

---

## 5. Editorial section components to BUILD

All under `components/how-it-works/sections/` (NEW dir — avoids clashing with the old
components still in `components/how-it-works/`). Each is a default + named export. Use the
heading idiom from §1. Copy below is **paste-ready and authoritative** — do not paraphrase the
factual lines. Wrap reveals in the existing **`Reveal`** component (named export from
`@/components/anim/Reveal`, props `{children, delay?, className?}`) and use **`MaskLines`** for
headline line-rises where it fits (named export from `@/components/anim/MaskLines`, props
`{lines: ReactNode[], className?, lineClassName?, delay?}`). NOTE the path: both live under
`components/anim/`, NOT `components/how-it-works/`. Each section: a `<section>` with generous vertical padding (`py-24 sm:py-32`),
content max-width ~`max-w-[var(--maxw-content)]` centered, and a **mono section marker** the
verifier can grep, e.g. `data-hiw="overview"`.

### `HiwHeader.tsx` — sticky top bar
Sticky, `z-50`. **TOKEN GOTCHA:** it is fixed/sticky and NOT reliably inside the light frame's
token scope — use **explicit hex**, not tokens, for its colors (bg `#fefefe`, border
`#e7e7e7`, ink `#14161c`, muted `#646464`). Left: a wordmark "Alpha & Oversight" (mono, the
"&" can be `.font-display`). Right: anchor links to the section ids (`#overview`,
`#methodology`, `#different`, `#see-it-live`) + a small "Read the report" link →
`/alpha-oversight-report.pdf`. A back-to-home link "← Home" → `/`. Keep it slim; subtle bottom
hairline. Marker `data-hiw="header"`.

### `HiwHero.tsx` — the opener (bolder)
The signature moment. Dark stage (`data-section="dark"`, `.ops-grain`, `.ops-grid
.ops-grid-fade` backdrop). A huge `.font-display` headline, a mono eyebrow, a tight sub-line,
and a self-drawing **order-lane motif** (a thin SVG order-book lane with a few PLACE/CANCEL
ticks that draw in — keep the concept, elevate it; reduced-motion = static). Two CTAs: primary
"Watch it run live" → `/desk`; secondary "Read the report" → `/alpha-oversight-report.pdf`.
- Eyebrow: `ALPHA & OVERSIGHT · HOW IT WORKS`
- Headline (two-tone display): **"The adversary invents. The system learns."**
- Sub-line: "Adversarial trade-surveillance, refereed by a Band of agents — where a model
  invents new market manipulation and deterministic code, not an LLM, renders every verdict."
- A thin mono fact-strip under the hero: `8 agents + 1 rule engine` · `2 desks · 1 wall` ·
  `4 → 5 rules` · `100% deterministic verdicts`. (All system-true — do not embellish.)
- Marker `data-hiw="hero"`.

### `MotivationSection.tsx` — §3.1 "Why this exists" (light, no diagram)
Heading two-tone: "Why this exists". Body (paste-ready, two paragraphs):
> Markets can be rigged. A trader can post orders they never plan to fill to fake demand
> (spoofing), stack fake depth across price levels (layering), trade with themselves to invent
> volume (wash trading), or push the closing price to mark their own book. Regulators write
> rules against each of these, but the rules are fixed while the tactics keep moving — a small
> change to a known trick can slip a rule written for last year's version of it.
>
> Two obvious fixes both fall short. Writing new rules by hand is slow and always a step
> behind. Letting an AI model decide the verdict is worse: the decision becomes a black box a
> regulator can't audit and an opponent can try to talk its way past. Alpha & Oversight keeps
> the verdict deterministic and auditable, and lets the system write its own new rules the
> moment an old one is beaten.

Optionally set the four tactic words (spoofing/layering/wash/marking) as small mono inline
chips. Marker `data-hiw="motivation"`.

### `HiwOverview.tsx` — §3.2 "The whole picture" + D1 (the centerpiece overview)
Heading: "The whole picture". Body (paste-ready):
> The system is built from two desks that never share a model or a memory. They talk only
> through Band, a message bus that carries every handoff. The **R&D desk** is the red team: one
> Adversary that invents new evasions. The **Surveillance desk** is the blue team: seven agents
> that investigate a case, plus one rule engine that is not an agent at all. The rule engine is
> plain code, and it is the only thing that decides PASS or FLAG.
>
> Order flow crosses a one-way wall: only the bare orders move from R&D to Surveillance, with
> the adversary's reasoning and model identity stripped off first. Every message is sealed into
> a hash-chained ledger, so the whole decision can be replayed and checked.

Then a full-width **dark stage** embedding `<ArchitectureDiagram />` (import from
`@/components/how-it-works/diagram/ArchitectureDiagram`). Below it, a rebuilt **two-desks**
split: R&D (red team, 1 agent, tone `rnd`) | Surveillance (blue team, 7 agents, tone `surv`),
with the Chinese-wall / SanitizedBridge note between them. Keep it editorial (cards, not a
second diagram). Marker `data-hiw="overview"`, give the stage `id="overview"`.

### `Methodology.tsx` — §3.3 the five sub-flows (the spine of the page)
A `data-section="dark"` cinematic run (or alternating light/dark per sub-flow — your call, keep
it legible). Each sub-flow = a `MethodBlock` (eyebrow `(a)…(e)`, two-tone heading, lead-in
paragraph, then its visual). Build a local `MethodBlock` layout helper. Visuals:
- **(a) Following one case, end to end** → embed `<CaseRelayDiagram/>` (D2). Lead-in:
  > A case moves down a line of agents that never call each other directly — each drops its
  > work on Band and the next picks it up. The Anomaly Detector computes hard features
  > (cancel-to-fill, book depth, self-match) and decides if the flow looks suspicious. The
  > Investigator recruits the right Specialist by those features, not by a guess. The
  > Specialist proposes the contested inputs the engine can't derive — the time window, the
  > bona-fide orders, the intent. Prosecution and Defense then argue the case locally, off
  > Band, and the Adjudicator settles their numbers.
- **(b) Inventing a new evasion** → embed `<OracleLoopDiagram/>` (D3). Lead-in:
  > A new tactic is never used until it proves itself twice. The Adversary proposes an order
  > sequence, and two deterministic referees gate it: the real rule engine must miss it (it
  > evades), and a backtest must show it makes money and moves the price (it's real). Only a
  > sequence that evades *and* profits crosses the wall.
- **(c) Who decides the verdict** → embed `<VerdictDiagram/>` (D4) + a compact **four seed
  detectors** strip (rebuilt, not the old component): spoofing & layering (FINRA 5210), wash &
  marking (SEC 10b-5), each with its cited metric + threshold (see §0.4). Lead-in:
  > The verdict is never an opinion. The engine takes the order events, the inputs the debate
  > resolved, and the active rules, then runs each rule's math. The first rule that trips
  > returns a FLAG with the rule id and the exact metric that crossed the line; if none trip,
  > the case passes. The agents only shape the contested inputs. The engine alone turns them
  > into PASS or FLAG, the same way every time.
- **(d) Closing the loop** → leave a render slot `{props.evasionSlot}` (integration mounts the
  reused `EvasionStory` here). Lead-in:
  > Here is the part that makes it self-improving. When the Adversary's novel evasion reaches
  > the engine, the seed rules miss it and the case passes — but because the flow still looked
  > suspicious, it escalates to a human instead of closing. A compliance officer confirms it
  > really is manipulation, and that one click does the rest: a new rule is derived from the
  > case, replayed through a regression gate to prove it now flags, and codified. Active rules
  > go from four to five, and the case flips from PASS to FLAGGED. The Adversary has to invent
  > something new.
- **(e) Why you can trust it** → embed `<TrustDiagram/>` (D6). Lead-in:
  > Two things carry the trust. The wall (the SanitizedBridge) strips the adversary's reasoning
  > and model identity before any order crosses, so the blue team can't be coached. The ledger
  > seals every Band message into a hash chain — each entry's hash is built from the previous
  > hash plus the message body, and binds the real Band message id. Change one byte and the
  > chain breaks, so `verify_chain()` returns false. The decision isn't just recorded; it's
  > tamper-evident.

**Component contract:** `Methodology` takes `{ evasionSlot?: React.ReactNode }` and renders it
in sub-flow (d). Import D2/D3/D4/D6 directly. Give the section `id="methodology"`, marker
`data-hiw="methodology"`.

### `ProjectStructure.tsx` — §3.4 (light, compact module map, no diagram)
Heading: "How the code is organized". A compact stacked list / two-column table, `Reveal`
stagger, mono module names. Intro line:
> The backend keeps the deterministic core apart from the agents that feed it.
Then the module rows (mono name + plain description):
- `rules/` — the rule engine, the per-family math, and the rule registry.
- `agents/` — the agents and their specialist registry.
- `band/` — Band transport and the SanitizedBridge wall.
- `audit/` — the hash-chained ledger.
- `state/` — the case state machine.
- `server/` — the FastAPI server (SSE stream, case endpoints, demo triggers).
Closing line: "Every flag can be traced from a Band message all the way to a cited rule."
Marker `data-hiw="structure"`.

### `WhatsDifferent.tsx` — §3.5 + the model-family-diversity panel
Heading: "What's actually new". A thesis line, then a **2×3 feature grid** (six cards, mono
title + one-line body), then the **model-family-diversity panel** (the matrix in §6). Cards:
- **The code decides, not a model.** The rule engine is the only authority for PASS or FLAG.
- **The rulebook co-evolves.** A confirmed miss becomes a regression-tested rule in one step.
- **The wall is structural.** Two separate Band identities; the crossing strips reasoning and
  model identity. Isolation by construction, not policy.
- **The audit binds real messages.** The hash chain ties each step to a real Band message id.
- **Different model families guard each other.** The four seats on an adversarial boundary run
  four different model families, so a blind spot in one can't quietly pass to the next.
- **Both gates are deterministic.** A new evasion must beat the real engine *and* profit in a
  backtest. Neither test is an LLM.
Give the section `id="different"`, marker `data-hiw="different"`.

### `SeeItLive.tsx` — §3.6 closing CTA (dark, bold)
Heading: "See it live". A short line, then two actions: primary **"Watch it run live" → `/desk`**;
secondary **"Read the full report (PDF)" → `/alpha-oversight-report.pdf`**. Keep it cinematic
(dark stage, `.ops-seam` top, band-blue glow on the primary CTA only if it's genuinely the
"go to the live Band" action). Give it `id="see-it-live"`, marker `data-hiw="see-it-live"`.

---

## 6. The model-family-diversity matrix (current backend, 2026-06-17)

Render this in `WhatsDifferent`. **The four adversarial-boundary seats run four different
families — that is the differentiator.** Highlight the family column.

| Seat | Model | Family |
|------|-------|--------|
| Adversary (R&D) | `claude-opus-4-8` | **Anthropic** (frontier) |
| Prosecution | `Kimi-K2.7` | **Moonshot** |
| Defense | `DeepSeek-V4-Pro` | **DeepSeek** |
| Adjudicator | `GLM-5.2` | **Zhipu** |
| Escalation Manager | `Qwen3.5-397B` | Qwen |
| Anomaly · Investigator · Specialist | `Qwen3-Next-80B` | Qwen |
| Rule engine | — deterministic | — |

Supporting line: "The four seats that sit on an adversarial boundary — adversary, prosecution,
defense, adjudicator — run four different model families. A manipulation the Anthropic adversary
hides should be caught by a Moonshot prosecutor, weighed against a DeepSeek defender, and
adjudicated by a Zhipu model — none of which share the adversary's blind spots."

**Tier note** (don't regress): only Prosecution + Escalation were the old "frontier" seats;
under the current matrix the Adversary is the frontier model. Never call the whole Surveillance
desk "frontier."

---

## 7. Conventions checklist (every file)

- [ ] `"use client"` first line if it animates / uses hooks.
- [ ] Imports from `./kit` (diagrams) / `@/components/how-it-works/Reveal` etc. (sections).
- [ ] `useReducedMotion` fallback (inherited via kit / `Reveal`; if you animate directly, add it).
- [ ] `EASE` 4-tuple for framer-motion eases.
- [ ] No hard-coded hex (except `HiwHeader`).
- [ ] band-blue only for on-Band; verdict colors keep meaning; one gold engine.
- [ ] A grep-able `data-hiw="…"` marker on each section; section ids where listed.
- [ ] Default + named export.
- [ ] `npx tsc --noEmit` would pass (correct prop types, no `any` leaks).

## 8. Integration (done by the lead, not build agents)
`app/how-it-works/page.tsx` composes, in order: HiwHeader · HiwHero · MotivationSection ·
HiwOverview · Methodology (with `evasionSlot={<EvasionStory/>}`) · ProjectStructure ·
WhatsDifferent · SeeItLive. Root `data-surface="ops" data-section="light"`. TopologyGraph
(the live xyflow gem) is reused as a teaser in SeeItLive/Overview if it can be fed a fixture
model (decided at integration). Then `npx tsc --noEmit` + `npm run build` to green.
