# Alpha & Oversight

**An adversarial trade-surveillance system where AI agents argue and deterministic code decides.**

A red-team adversary invents new market-manipulation tricks; a blue-team surveillance desk
hunts them down; a small, deterministic rule engine — *not* a language model — renders every
PASS/FLAG verdict. When the rulebook misses a brand-new evasion, a human confirms it and the
system **writes a new rule on the spot**, then proves the rule catches it. Every message that
coordinates the agents is sealed into a hash-chained audit ledger you can re-verify live.

Built for the lablab.ai **Band of Agents** hackathon. This repository is a monorepo:

```
alpha-oversight/
├── backend/     FastAPI service — agents, Band, rule engine, audit ledger, state machine
└── frontend/    Next.js 16 Command Center — landing site, scroll-story, live trace viewer
```

> The two halves are decoupled by a single environment flag. The frontend runs entirely on
> bundled fixtures (`mock` mode, no backend needed) or against the live backend (`live` mode)
> with no code change in between.

---

## 1. The big idea

Traditional trade surveillance is a static rulebook: it only catches tricks someone already
wrote a rule for. Alpha & Oversight closes that loop. It runs **two desks separated by a
Chinese wall**:

- **R&D desk (red team)** — a single **Adversary** agent designs order sequences engineered to
  *evade every active rule while still making money*.
- **Surveillance desk (blue team)** — seven agents triage, investigate, debate, and adjudicate
  suspicious order flow, feeding a deterministic engine that returns the verdict.

When the adversary finds an evasion the rulebook genuinely misses, the case is **escalated to a
human**. If the human confirms it is manipulation, the system derives a new rule, **regression-
gates** it (proves it now flags the evasion), and **codifies** it — the rulebook grows from four
rules to five, and the cat-and-mouse resets one level harder.

**The cardinal rule: LLMs argue; code decides.** Agents only set the *contested inputs* the
engine cannot derive on its own (the time window, which orders were bona-fide, the likely
intent). The engine renders PASS/FLAG deterministically. No LLM can overrule it. Same inputs,
same verdict, every time.

---

## 2. The cast — 8 LLM agents + 1 deterministic rule engine

Seven agents work the Surveillance desk; one is the lone Adversary on R&D. **The rule engine is
not an agent** — it is plain Python that owns the final verdict.

| Agent | Desk | Role | Model (logical key → model) | Tier |
|---|---|---|---|---|
| **Adversary** | R&D | Red team. Proposes order sequences engineered to slip past every active rule while still making money. | `open-triage` → Qwen3-Next-80B | open |
| **Anomaly Detector** | Surveillance | First glance at a window of orders; flags "this smells off" and computes hard features (cancel ratios, depth, self-match). | `open-triage` → Qwen3-Next-80B | open |
| **Investigator** | Surveillance | Opens the case and recruits the right specialist over Band. The only tool-using agent (ReAct loop). | `open-triage` → Qwen3-Next-80B | open |
| **Specialist** | Surveillance | Domain expert for one manipulation family; proposes the contested inputs the engine cannot derive alone. | `open-triage` → Qwen3-Next-80B | open |
| **Prosecution** | Surveillance | Argues the reading that makes the order flow look *most* like manipulation. | `prosecution-frontier` → claude-sonnet-4-6 | **frontier** |
| **Defense** | Surveillance | Argues the innocent reading — legitimate, bona-fide trading. | `defense-open` → Qwen3.6-35B | open |
| **Adjudicator** | Surveillance | Reads both arguments and resolves them into one set of engine-ready inputs. | `open-triage` → Qwen3-Next-80B | open |
| **Escalation Manager** | Surveillance | When the rulebook misses, packages a clear brief for the human and recommends an action. | `escalation-frontier` → gpt-5-mini | **frontier** |
| **Rule Engine** | — | *Not an agent.* Deterministic code; the single authority that returns PASS or FLAG. | — | — |

**Two frontier roles, not a frontier desk.** Only the two roles that must be most persuasive —
**Prosecution** and the human-facing **Escalation Manager** — run frontier models. Everyone else
runs a strong, cheaper open-weight model. Which model sits behind each role is just configuration
(env-driven provider routing in `backend/.../providers.py`), so the mix can change without
touching the pipeline. Model providers: **AI/ML API** (frontier) and **Featherless** (open).

---

## 3. Band — the transport of record

Band is the message bus the agents coordinate over. The single most important thing to
understand: **Band is the transport of record, not a notification channel.** Every cross-agent
handoff is an envelope sealed into the audit ledger.

Every envelope has a `kind`, a `from`, a `to`, a `case_id`, and a `payload`. There are **five
kinds** (exact wire values are lowercase):

| Kind (`kind`) | Carries | Sent when |
|---|---|---|
| `handoff` | Order-flow events; a recruit request | R&D crosses the wall; Investigator recruits a Specialist |
| `evidence` | The Specialist's proposed contested inputs | After the Specialist studies the flow |
| `verdict` | The engine's PASS/FLAG + the resolved inputs | After the engine scores the case |
| `escalation` | The human briefing packet | When the rulebook misses and a human is needed |
| `rule_codified` | The brand-new rule + proof it works | The moment a human confirms a novel pattern |

> The **Prosecution ⚔ Defense debate runs locally** within the Surveillance desk — it does **not**
> travel over Band. Only the steps that are genuine cross-agent handoffs become Band messages.

**Two Band implementations, one Protocol interface:**
- **MockBand** — in-process loopback for development and the keyless demo. Same message
  semantics, no network.
- **PhoenixBand** — the real Band, spoken over REST polling (`POST /chats/{room}/messages` to
  send, `GET .../messages/next` to pull, then ack `processing → processed`).

### The Chinese wall (`SanitizedBridge`)

The wall is two things:
1. **Two separate Band identities.** R&D and Surveillance log in as different agents and cannot
   read each other's private rooms.
2. **One narrow, one-way bridge.** The `SanitizedBridge` is the *only* path from R&D to
   Surveillance. It copies the raw order events and **strips the adversary's reasoning and even
   which model produced it**. What crosses is raw market behaviour — nothing about *why* it was
   produced.

The only channel in the other direction is the **rulebook itself**, which the Adversary may
**read but never write** (so it knows what to beat). Surveillance can never peek at the R&D
playbook.

---

## 4. The deterministic rule engine

The verdict is not an opinion from a language model — it is the output of a small, deterministic
rule engine (`backend/.../rules/engine.py`). The engine walks the list of active rules; for each
it runs that rule's maths over the order events. If any rule trips, it returns **FLAG** plus
exactly which rule fired and which number crossed the line. If none trip, **PASS**. Same inputs,
same answer, every single time.

**Contested inputs** (what the LLMs supply; the engine cannot derive these alone):
- **The time window** — which orders count as part of "the same burst"?
- **Bona-fide orders** — which orders were honest trades that should be excluded?
- **Intent** — what does the surrounding behaviour suggest the trader was trying to do?

### The four seed rules

Out of the box there are four seed rules — **layering** + **spoofing** (FINRA 5210) and **wash
trading** + **marking-the-close** (SEC 10b-5). Each is a family of maths plus a threshold. Exact
params and trip conditions as implemented in code:

| Rule id | Family | Params | Trips when |
|---|---|---|---|
| `FINRA-5210-layering` | `layering` | `window_ms: 100`, `min_depth_levels: 3` | `depth_levels ≥ 3` **and** `cancel_span_ms ≤ window_ms` |
| `FINRA-5210-spoofing` | `spoofing` | `window_ms: 100`, `min_cancel_ratio: 0.8` | `near_fill_cancel_ratio ≥ 0.8` |
| `SEC-10b-5-wash` | `wash_trade` | `min_self_match_ratio: 0.5` | `self_match_ratio ≥ 0.5` |
| `SEC-10b-5-marking` | `marking` | `min_print_move_bps: 100.0` | `eod_print_move_bps ≥ 100` |

> Note: spoofing trips on **`near_fill_cancel_ratio`** (cancels placed near opposite-side fills),
> not the raw cancel-to-fill ratio. The wash and marking thresholds are inclusive (`≥`).

### Codification (rules 4 → 5)

When a human confirms a novel evasion, four things happen automatically:
1. **Derive** a new rule shaped to catch this exact variant. Derived id: `{family}-v2-{case_id}`;
   provenance `human:compliance/{case_id}`.
2. **Regression-gate** it — re-run the engine with the new rule and prove it now FLAGs the
   evasion. If the proof fails, the rule is **rejected** (HTTP 422), nothing is written.
3. **Codify** it — the rulebook grows from four to five and a `rule_codified` Band message goes
   out (and into the audit ledger).
4. **Flag** the case — it moves from `ESCALATED` to `FLAGGED`.

---

## 5. Case lifecycle — five states

A case is always in exactly one of five states:

| State | Meaning |
|---|---|
| `OPEN` | Just created, not yet triaged. |
| `UNDER_REVIEW` | The detector found something; the pipeline is working it. |
| `FLAGGED` | Judged to be manipulation (directly in Beat A, or after a human confirms in Beat B). |
| `ESCALATED` | The rulebook missed it; waiting on a human. |
| `CLOSED` | Finished: clean, dismissed, or archived. |

**Every non-final state has a timeout that sends the case to `CLOSED`** — a case can never get
stuck waiting forever. The two human-driven transitions from `ESCALATED` are: *confirm* →
`FLAGGED`, *reject* → `CLOSED`.

---

## 6. The two beats (the demo)

### Beat A — catching a known trick

`OPEN` → detector smells it → `UNDER_REVIEW` → Investigator recruits a Specialist (`handoff`) →
Specialist proposes contested inputs (`evidence`) → Prosecution ⚔ Defense debate (local) →
Adjudicator resolves → **engine FLAGs** (`verdict`) → `FLAGGED`. (If the detector finds nothing,
the case closes immediately.)

### Beat B — learning a brand-new trick

The R&D loop runs first: the **Adversary** proposes sequences in bounded rounds (K rounds). Two
deterministic referees judge each: *(1) did it evade?* — run the real engine; if it returns PASS
the rulebook missed it. *(2) was it real?* — backtest it; the sequence must actually make money
and move price. A sequence that **evades and profits** is a confirmed novel evasion — the only
thing allowed across the wall.

The confirmed evasion runs through the Surveillance pipeline; the engine returns **PASS** (the
rules genuinely miss it), so the case is **`ESCALATED`**. The human reads the Prosecution/Defense
dossiers and the audit trail and decides: **confirm** → derive + regression-gate + codify (rules
**4 → 5**, emit `rule_codified`) → `FLAGGED`; or **reject** → `CLOSED`, no rule written.

---

## 7. Audit — tamper-evident memory

Every message that crosses Band is sealed into a **hash-chained ledger**. Each leaf records one
Band message: which case, which kind, who sent it, who received it, the direction, a **SHA-256
fingerprint of the exact content**, and the real Band message id. Each leaf's hash folds in the
previous leaf's hash, so changing anything — a payload, an order, even one character — makes the
recomputed chain disagree with the stored one.

`verify_chain()` walks every link (canonical JSON, `sort_keys`, SHA-256) and returns `true` only
if the whole history is intact. The Command Center's audit view shows a **live `verified` badge
recomputed on the spot** — not a stored boolean — over the real Band message hashes.

---

## 8. API surface

The backend is a small FastAPI service on **port 8000**.

| Method | Path | What it's for |
|---|---|---|
| `GET` | `/stream` | SSE: live trace of every agent action, desk-tagged. Filters: `?desk=rnd\|surveillance`, `?replay=<case_id>` for recorded playback. |
| `GET` | `/cases` · `/cases/{id}` | List cases / one case in full (state, verdict, features, events, resolved_inputs). |
| `GET` | `/cases/{id}/audit` | Hash-chain ledger rows for the case + a freshly recomputed `verified` flag. |
| `GET` | `/rules` | The current active rulebook. |
| `GET` | `/stats` | Headline counts: `total_cases`, `by_state`, `flagged`, `escalated`, `active_rules`. |
| `POST` | `/cases/{id}/confirm` | Human confirms an escalation → derive + prove + codify → `FLAGGED`. 409 if not ESCALATED; 422 if the regression gate fails. |
| `POST` | `/cases/{id}/reject` | Human dismisses an escalation → `CLOSED`, no rule written. |
| `POST` | `/demo/beat-a` · `/demo/beat-b` · `/demo/rnd` | One-click triggers for the two beats and a live adversary run. |

### SSE `/stream` frame shape

The stream emits one small JSON frame per agent action, all the same shape:

```jsonc
{
  "agent_name": "Investigator",          // who acted ("pipeline" for stage markers)
  "model_id":   "prosecution-frontier",  // logical model key ("" for pipeline markers)
  "desk":       "surveillance",          // "surveillance" | "rnd"
  "content":    "recruited @layer-spec (layering)",  // human-readable marker / @mention
  "reasoning":  null,                     // model reasoning if any (not stripped from the feed)
  "tool_calls": [],                       // [{ name, id, arguments, result }]
  "created_at": "2026-06-16T18:33:00Z"
}
```

Stage progress is carried by `agent_name: "pipeline"` frames whose `content` is a marker string.
The frontend parses these markers (the case id lives **only** inside `content` — frames carry no
`case_id` field):

```
opened case <case_id>
detector clean -> CLOSED
suspicious -> UNDER_REVIEW; features={...python repr...}
recruited <handle> (<family>)
debate complete
verdict=<PASS|FLAG> rule=<rule_id|None>
case <case_id> -> <FINAL_STATE>
```

---

## 9. Running it live

Three moving parts: the browser, the backend, and the outside services it calls. For a quick
demo you can skip the outside services entirely — mock Band + recorded fixtures look identical to
a live replay.

```bash
# 1) Backend — serves :8000
cd backend
#   set LLM + Band keys in ../.env for a full live run,
#   or leave USE_REAL_BAND=false for the keyless demo (MockBand + fixtures)
make run-backend            # uvicorn ...app:create_app --factory --port 8000

# 2) Frontend — serves :4100
cd ../frontend
#   .env.local:
#     NEXT_PUBLIC_DATA_MODE=live          # or "mock" (default) for no backend
#     NEXT_PUBLIC_API_BASE=http://localhost:8000
npm install && npm run dev
```

Then open `http://localhost:4100`, go to the **Live Command Center** (`/desk`), trigger a beat
from the controls (`/demo/beat-a` or `/demo/beat-b`), and watch the topology, timeline, dossiers,
and audit update live.

**Runtime layout:** Browser (Command Center) → Next.js `:4100` → REST + live SSE → FastAPI
`:8000` → Band (mock or real) + model providers (AI/ML API · Featherless).

---

## 10. The frontend (Command Center)

A Next.js 16 (App Router) / React 19 / Tailwind v4 site cloning the AlphaLedger visual identity,
themed for adversarial surveillance:

- **`/`** — the landing story (pinned hero, system-fact figures, feature carousel, the Band
  nonagon, the hash-chain staircase, FAQ, CTA).
- **`/how-it-works`** — a scroll-story: the pipeline end-to-end, the two desks, the agent roster,
  "The Evasion" beat-by-beat, the four detectors, the deterministic close.
- **`/desk`** — the **Live Command Center**: a scroll-story (server surface, the data-flow scrub,
  interactive high-impact demos — tamper test, Band envelope, co-evolution ladder) ending in the
  **real, functional trace viewer** that runs Beat B against the backend (or fixtures in mock
  mode).

The data seam (`frontend/lib/`): `config.ts` (the mock/live flag), `api/` (REST client +
TanStack Query), `eventsource/` (the SSE adapter + marker parser), `desk/` (the `useDeskModel`
fold that turns raw events into one tidy shape every panel reads), `fixtures/` (the bundled
recorded beats). Live events feed a zustand `traceStore`; a single fold derives the topology,
timeline, dossiers, verdict, and case state; REST data (rules, stats, audit) is cached separately
and refetched when a meaningful marker (verdict, escalation, codify) comes down the stream.

---

## 11. Accuracy notes (frontend ↔ backend ↔ spec)

The frontend's contract was audited against the live backend code. A few things to keep straight:

- **Band kinds are lowercase on the wire** (`handoff`, `evidence`, `verdict`, `escalation`,
  `rule_codified`). Uppercase forms (`HANDOFF`, …) are display labels only.
- **SSE frames carry no `case_id` field** — the case id is parsed from the `opened case <id>` and
  `case <id> -> <state>` markers in `content`.
- **`direction`** on an audit leaf is `"sent"` or `"recv"` (not `"received"`).
- **`model_id` on the stream is a logical key** (`open-triage`, `prosecution-frontier`,
  `escalation-frontier`, `defense-open`), not the raw provider model name. The UI maps it to a
  tier badge (anything containing `frontier` → frontier, else open).
- Never fabricate marketing stats (alert counts, false-positive %, analyst-hours, latency SLAs).
  The only system-true numbers are structural: **8 agents + 1 rule engine, 4 seed rules, 5 Band
  kinds, 5 case states, 100% deterministic verdicts.**

---

*This README was generated from the project's own backend and frontend source, so the names,
flows, and contracts above match the code.*
