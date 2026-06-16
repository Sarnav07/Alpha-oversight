# Alpha & Oversight — Backend Architecture Summary

> **What this is:** a self-contained walkthrough of the backend we built — every agent,
> how many there are, what each does, and exactly how they coordinate through **Band**.
> Companion to the locked `design.md` (architecture) and `BUILD_BLUEPRINT.md` (interfaces).
> Status: **backend complete, 197/197 tests green, runs over real Band on the live model mix.**

---

## 1. The one-paragraph version

Alpha & Oversight is an **adversarial trade-surveillance harness**. Two desks coordinate
over Band: an **R&D desk** that invents market-manipulation strategies designed to *evade*
detection, and a **Surveillance desk** that tries to catch them. The Surveillance desk is a
pipeline of specialized LLM agents that investigate an order flow, stage a **Prosecution vs.
Defense debate**, and hand their findings to a **deterministic rule engine** — which is the
*only* component allowed to render the PASS/FLAG verdict. When a novel evasion slips all
current rules, the system **escalates to a human**, who confirms, and a new rule is
**derived, regression-tested, and codified** live — the rule set grows `4 → 5` on screen.
Every step is a real **Band message**, and every verdict is backed by a **hash-chained audit
ledger** whose leaves bind real Band message IDs (`verify_chain()` proves nothing was
tampered with).

---

## 2. How many agents, and who they are

**9 agent roles total** — 8 on the Surveillance desk pipeline + 1 R&D adversary.
All inherit from `agents/base_agent.SurveillanceAgent` and run on the same ReAct loop
(`reused/agent_loop.py`), but each has its own role prompt, output schema, and model.

| # | Agent | Desk | Job | Model (live mix) |
|---|-------|------|-----|------------------|
| 1 | **AnomalyDetector** | Surveillance | First-pass triage: scans the order flow, flags "is this abnormal?" using deterministic features | `Qwen3-Next-80B-A3B-Instruct` |
| 2 | **Investigator** | Surveillance | Pulls the thread — runs tools (recruit/inspect) in a loop to gather evidence on the flagged flow | `Qwen3-Next-80B-A3B-Instruct` |
| 3 | **Specialist** | Surveillance | Family expert (spoofing / layering / wash-trade / marking) selected at runtime by feature vector | `Qwen3-Next-80B-A3B-Instruct` |
| 4 | **Prosecution** | Surveillance | Argues the flow **IS** manipulation; sets the engine's contested inputs aggressively | `claude-sonnet-4-6` (AI/ML) |
| 5 | **Defense** | Surveillance | Argues the flow is **benign**; pushes back on Prosecution's inputs | `Qwen3.6-35B-A3B` (Featherless) |
| 6 | **Adjudicator** | Surveillance | Resolves the debate into the engine's *ambiguous* inputs (esp. the time window) — **conservatively** | `Qwen3-Next-80B-A3B-Instruct` |
| 7 | **EscalationManager** | Surveillance | When a suspicious flow passes all rules, packages it for the human overseer | `gpt-5-mini` (AI/ML) |
| 8 | **Adversary** | R&D | Invents new manipulation order-flows designed to evade the current rule set | `Qwen3-Next-80B-A3B-Instruct` |
| — | **Rule Engine** | Surveillance | *Not an LLM.* Deterministic per-family math renders the authoritative PASS/FLAG verdict | n/a (code) |

> The **rule engine is the 9th "voice" but it is code, not a model.** This is the central
> invariant: **LLMs debate and set inputs; they never decide the verdict.** That's what makes
> the output defensible in a regulated context.

**Why these models:** the two adversarial-debate roles (Prosecution `claude-sonnet-4-6`,
Defense `Qwen3.6-35B-A3B`) are *cross-vendor on purpose* — a frontier closed model vs. an
open model gives a genuine contrast instead of one model arguing with itself. Escalation uses
`gpt-5-mini` (a reasoning model — escalation decisions are rare and worth the latency). The
four "plumbing" roles run on `Qwen3-Next-80B-A3B-Instruct` — a big (80B) but **non-thinking**
MoE (3B active), so it's large/capable yet fast across four sequential calls. (GLM-4.6 and
MiniMax-M2 were rejected: they're *thinking* models, too slow for plumbing.)

---

## 3. The two desks and the Chinese wall

The whole design hinges on a **regulatory Chinese wall** between the desk that *invents*
manipulation (R&D) and the desk that *detects* it (Surveillance). If the cop could read the
adversary's reasoning, the benchmark would be meaningless.

```
        ┌─────────────────────────┐                 ┌──────────────────────────────┐
        │   R&D DESK (adversary)  │                 │   SURVEILLANCE DESK (cop)    │
        │   Band identity: rnd    │                 │   Band identity: surveillance│
        │                         │                 │                              │
        │  Adversary invents an   │  order-event    │  AnomalyDetector             │
        │  order-flow to evade    │  DATA only      │    → Investigator            │
        │  the current rules ─────┼────[ BRIDGE ]───┼──→ Specialist                │
        │                         │   strips        │    → Prosecution ⚔ Defense   │
        │  Gated by TWO oracles:  │   reasoning +   │    → Adjudicator             │
        │   • engine PASS (evaded)│   model_key     │    → RULE ENGINE (verdict)   │
        │   • backtest PROFITABLE │                 │    → EscalationManager       │
        └─────────────────────────┘                 └──────────────────────────────┘
                                                                   │
                                                                   ▼  escalation
                                                            ┌────────────┐
                                                            │   HUMAN    │  confirm → codify
                                                            └────────────┘
```

**Two enforcement mechanisms:**
1. **Two separate Band identities** (`rnd` and `surveillance`) — they are genuinely different
   Band participants with different agent IDs/keys, not just `@mention` labels.
2. **`band/bridge.py` (`SanitizedBridge`)** — the *only* channel across the wall. It strips
   `reasoning` and `model_key` from every payload, so the Surveillance desk receives **only
   the raw order-event data**, never the adversary's intent or which model produced it.

**The R&D desk never writes or executes code.** The adversary emits *order-event data*
(PLACE/MODIFY/CANCEL sequences), never LLM-authored code — so there's no Docker, no sandbox,
no exec. Its output is judged by **two oracles**: the deterministic rule engine (did it
**evade** detection?) and the backtest engine (was it actually **profitable**?). A strategy
only "counts" as a real evasion if it slips the rules *and* makes money.

---

## 4. Band as the coordination spine

**Band is transport-of-record**, not a side-channel. Every handoff between agents is a real
Band message; the payload rides *inside* the Band message body.

- **`band/transport.py`** — `BandTransport` Protocol. Two implementations satisfy it
  identically (drop-in): `MockBand` (default, in-process broker) and `PhoenixBand` (real
  Band, REST-poll mode).
- **`band/mock_band.py`** — the default for tests/dev. `MockBand.pair("rnd", "surveillance")`
  creates two identities on one in-process broker. No network.
- **`band/phoenix_band.py`** — the real transport. REST-poll mode:
  `GET /messages/next` → `/processing` + `/processed` ACKs → `POST .../messages`. Robust; no
  Phoenix-WS heartbeat needed.
- **`band/handoff.py`** (`BandHandoff`) — the `@mention` round-trip adapter. Sends a message,
  dedupes on `msg_id`, carries the `desk` tag, and **records a ledger leaf** for every send.
- **`band/bridge.py`** (`SanitizedBridge`) — the cross-wall sanitizer (see §3).

**Band API constraints we discovered live (via 422s):**
- `mentions` array must have **≥1 entry** (empty → rejected).
- An agent **cannot mention itself** (`cannot_mention_self`).
- Internal sub-agent steps (specialist, prosecution, …) **aren't separate Band identities**,
  so they can't be mentioned. Solution: they fall back to `PhoenixBand.default_mention` =
  **the human overseer**. Nice side-effect — the human's Band view shows the *entire case*
  unfold step by step. (They can't mention the other desk either — that would breach the
  wall — so the human is the only valid target.)

**Case ↔ room decoupling:** `case_id` is independent of the Band room, so many cases can
share **one persistent shared room** (`BAND_SHARED_ROOM`).

---

## 5. The Surveillance pipeline (Beat-A: "catch a known pattern")

`orchestration/surveillance_pipeline.py` → `run_surveillance(...)`. Each arrow is a Band message.

```
[R&D order-events] ──bridge──▶ AnomalyDetector ──▶ Investigator ──(tool loop: recruit/inspect)──▶
   Specialist ──▶ ┌─ Prosecution ─┐
                  │   (staged      │──▶ Adjudicator ──▶ ┌──────────────────────┐
                  └─ Defense ──────┘   resolves the     │   DETERMINISTIC      │──▶ verdict
                      debate, ≤4 rounds  contested        │   RULE ENGINE        │   PASS / FLAGGED
                                         window           └──────────────────────┘
                                                                    │
                                                          PASS-but-suspicious │
                                                                    ▼
                                                          EscalationManager ──▶ HUMAN
```

1. **AnomalyDetector** computes deterministic **features** (`rules/features.py:compute_features`,
   which reuses the family math) and applies an `is_abnormal` triage floor. *Critical fix from
   the live run:* the LLM gets the computed features + an event table in the `flow_brief` —
   without real order data it always said "not suspicious."
2. **Investigator** runs a bounded **tool loop** (recruit a specialist, inspect the flow).
3. **Specialist** is chosen at runtime by `agents/specialist_registry.py` mapping the feature
   vector → the right family expert (spoofing / layering / wash-trade / marking).
4. **Prosecution ⚔ Defense** stage a debate (**≤4 rounds**), each setting the engine's
   contested inputs from opposite sides.
5. **Adjudicator** resolves the debate into the engine's *ambiguous* inputs — **conservatively**.
   It resolves `window_ms = 0` for non-clustered/drip patterns. **This is the load-bearing
   invariant for Beat-B:** a *wide* resolved window would override every seed rule and FLAG
   instantly, destroying the escalation demo. Widening a rule to manufacture a catch is the
   *human's* codify call, never the adjudicator's.
6. **Rule engine** (`rules/engine.py`) renders the authoritative verdict from per-family math.
7. If the flow is suspicious but **passes** all rules, **EscalationManager** packages it for
   the human → state `ESCALATED`.

---

## 6. Co-evolution (Beat-B: "learn a brand-new pattern") — the wow moment

This is what makes the harness *adaptive* rather than a static detector.

```
Adversary invents a NOVEL evasion (e.g. 400ms layering variant the 4 seed rules miss)
        │  (gated by BOTH oracles: engine PASS = evaded, backtest = profitable)
        ▼
Surveillance pipeline runs → suspicious but PASSES all rules → ESCALATED
        ▼
HUMAN confirms it's manipulation   (POST /cases/{id}/confirm)
        ▼
rules/codify.derive_rule(...)  → parameterizes a new rule (family inference +
        │                          debate-resolved window + slack/floors)
        ▼
rules/codify.regression_gate(...) → replays the evasion through the NEW registry;
        │                            returns True ONLY if it now FLAGs
        ▼
registry.codify(new_rule)  →  Active Rules  4 → 5
        ▼
engine.evaluate(...) re-runs  →  PASS → FLAGGED
        ▼
verify_chain() still holds  (a `rule_codified` leaf is appended to the ledger)
```

The system **taught itself a new detection rule from a single confirmed example**, proved the
rule works (regression gate), and grew its rule set live — all auditable.

`orchestration/rnd_loop.py` drives the adversary side: bounded `K` rounds, each gated by both
oracles, handing **only order-events** across the wall.

---

## 7. The deterministic core (why a regulator would trust this)

`rules/` is the authority. The LLMs never decide PASS/FLAG.

- **`rules/engine.py`** — evaluates a flow against the active rules; renders the verdict +
  the `cited_metric`/`cited_rule`.
- **`rules/math_{spoofing,layering,wash_trade,marking}.py`** — per-family detection math
  (e.g. layering depth/window, spoofing `near_fill_cancel_ratio`, wash-trade self-match).
- **`rules/features.py`** — `compute_features` (reuses the family math) + `is_abnormal` floor.
  Note: `cancel_to_fill` = spoofing's `near_fill_cancel_ratio` so layering doesn't pre-empt
  spoofing in `select_specialist`.
- **`rules/registry.py`** (`RuleRegistryStore`, SQLite) — the active rule set; `codify()` is
  idempotent on rule id.
- **`rules/seed_rules.py`** — the 4 curated seed families (FINRA-5210 layering, etc.).
- **`rules/codify.py`** — `derive_rule` + `regression_gate` (the Beat-B engine).

---

## 8. Audit ledger — the provenance chain

`audit/ledger.py` — an **append-only, hash-chained JSONL ledger**. Every Band handoff appends
a leaf binding `sha256(content)` **+ the real `band_message_id`** (field `bmid`). `verify_chain()`
walks the chain; a **1-byte tamper → `False`**. This is the bridge between "agents talked over
Band" and "the verdict is provably backed by those exact messages."

`audit/canonical.py` — canonical JSON so hashes are stable across runs/machines.

**Memory is 3 layers:** L1 = turn-aware in-context compaction (`reused/compaction.py`) ·
L2 = SQLite scratchpad/journal (`memory/`) · L3 = this audit ledger.

---

## 9. Provider routing (multi-vendor, no live network in tests)

All **4 `litellm.acompletion` sites** route through `reused/gateway.py:_acompletion` so the
per-model `api_base`/`key_env` (carried on an extended `ModelSpec`) and a process-wide
`asyncio.Semaphore(4)` (Featherless's 4-concurrent cap) apply everywhere. A bypassing call =
a live 404/429 on camera, so this is an invariant.

- **AI/ML API** — `aiml/<model>`, base `https://api.aimlapi.com/v1` (**not** `/v2` — `/v2` 404s),
  per-token → reserved for the frontier money roles (Prosecution, Escalation).
- **Featherless** — `featherless_ai/Org/Model`, base `.../v1`, flat-rate but only 4 concurrent
  slots → the open-model plumbing + Defense.
- **`gpt-5-mini` quirk:** rejects `temperature != 1`. Handled globally by
  `litellm.drop_params = True` (re-asserted in `providers.py`) + `max_tokens=8192` reasoning
  headroom in `register_models()`.

**Tests never hit the network:** `conftest.py` supplies `FakeGateway` + `MockBand`. 197 tests
green, fully offline.

---

## 10. Server surface (FastAPI)

`server/app.py:create_app` (factory) wires the lifespan and `app.state`, then mounts routes:

- **`routes_stream.py`** — `/stream` SSE (live activity feed, tagged by `desk`).
- **`routes_cases.py`** — `/cases`, `/cases/{id}/audit`, etc. (read the case + its ledger).
- **`routes_human.py`** — `POST /cases/{id}/confirm` → triggers derive → codify → regression →
  FLAGGED (the human-in-the-loop Beat-B trigger).
- **`routes_demo.py`** — `/demo/beat-a`, `/demo/beat-b` (canned, always-escalates evasion),
  `/demo/rnd` (the **live** adversary, two-oracle gated — non-deterministic by nature).

**`USE_REAL_BAND` switch:** `false` (default) → `MockBand.pair` on an in-process broker.
`true` → two real `PhoenixBand` identities on `BAND_SHARED_ROOM`, `default_mention` = human.

---

## 11. Data flow end-to-end (one sentence)

> R&D's adversary emits order-events → the bridge strips reasoning and passes raw data across
> the wall → the Surveillance pipeline (detect → investigate → specialize → prosecute/defend →
> adjudicate) feeds the deterministic engine → the engine renders PASS/FLAG → suspicious-but-
> passing flows escalate to a human → the human's confirm derives, regression-tests, and
> codifies a new rule (4→5) → every hop is a Band message and every verdict is `verify_chain()`-able.

---

## 12. What's done vs. what's left

- ✅ **Backend complete** — Phases 0–5 + Phase 7. 197/197 tests green.
- ✅ Beat-A (PASS→FLAGGED) and Beat-B (4→5 co-evolution) proven on **mock Band** *and*
  **real Band** on the live model mix.
- ✅ Real-Band whole choreography: every internal step is a real Band message; leaves bind
  real `band_message_id`s; `verify_chain()` holds.
- ⬜ **Phase 6 — frontend trace viewer** (the only remaining work; deploy folds into it).

See `tasks/todo.md` for the phase-by-phase tracker and `docs/LIVE_RUN.md` for the live-run
scripts and results.
