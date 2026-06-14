# Build Design — "Alpha & Oversight"

> **What this is:** the end-to-end build design for the *Band of Agents* hackathon (lablab.ai; submissions close **Jun 19 15:00 UTC** → ~6 days from Jun 13). Produced from current sponsor-doc research (cited) + a 4-agent reuse-map of our arena projects + a 4-critic adversarial pass (architecture / sponsor-integration / build-feasibility / demo-pitch). Every critic correction is folded in.
>
> **Two locked decisions:** (1) Band integration = a custom **BandHandoff** adapter, agents stay on the litellm arena loops; (2) Scope = **Surveillance desk complete + a thin-but-real R&D adversary**, with live rule-codification as the wow moment.

---

## Context (why this design is shaped the way it is)

The hackathon scores four equal criteria — **Application of Tech (Band as the real coordination layer)**, **Presentation**, **Business Value**, **Originality** — and *requires* ≥3 agents collaborating *through* Band (not a wrapper). We own five frontier-model "arena" benchmark projects whose staged pipelines are ~80% of a coordinated multi-agent loop. Track 3 (Regulated/High-Stakes) is the winnable lane: our audit-trail infrastructure is a Track-3 asset and a finance background is a moat.

The critic pass changed five things from the Phase-1 sketch, and the design below reflects the corrected reality, not the optimistic version:
1. **Band is the transport of record**, not a notifier. Handoff *payloads* ride inside Band messages; the ledger stores their hashes. Remove Band and coordination has no transport.
2. **The Chinese wall is enforced by two Band identities + a sanitized bridge**, not by polite `@mention` discipline (humans see all messages; same-owner peers are mutually discoverable).
3. **R&D emits *data* (order-event sequences), not LLM-written code** — no Docker, no `exec`. The oracle is the safe `backtest_engine.py` + the rule engine.
4. **No Postgres.** Each desk keeps a local SQLite ledger; Band carries the cross-desk artifacts. This removes a 2–3 day topology swamp.
5. **The deterministic rule engine is authoritative, but the Prosecution/Defense debate sets its *ambiguous inputs*** — so the debate is load-bearing without "LLMs grading LLMs."

---

## 1. Overview & Problem

**Product.** *Alpha & Oversight* is an **adversarial robustness harness for trade-surveillance**. Two desks coordinate through Band:

- **R&D desk (the adaptive adversary).** An LLM "quant" proposes an **order-event sequence** engineered to (a) **evade the current detection rule set** and (b) be **economically real manipulation** (it moves price / extracts value). Both are checked by deterministic oracles. A sequence that evades *and* profits is a **confirmed novel evasion**, handed across the wall to Surveillance.
- **Surveillance/Oversight desk (the product, the cop).** An **AnomalyDetector** triages the order-flow stream → an **Investigator** opens a case and **recruits the right specialist at runtime** (Band peers + an external capability registry, selection driven by order-flow features) → a **Prosecution** agent builds the violation case while a **Defense** agent argues exoneration; their debate **sets the contested inputs** the rule engine can't derive → a **deterministic rule engine** (formal spoofing/layering/wash-trade math) renders the **ground-truth verdict** → an **EscalationManager** routes ambiguous cases to a **human compliance officer** with both dossiers + an **immutable hash-chained audit file**.
- **The loop closes (co-evolution).** When Surveillance catches a novel evasion the rules **missed** but the human **confirms** as manipulation, a **new detection rule is codified live** (a row INSERTed into the rule registry on screen). A **regression gate** replays the evasion through the new rule and asserts it now trips. The rule set is stronger → R&D must invent a new evasion.

**User / buyer.** Market-surveillance & AML compliance teams at exchanges, brokers, and banks who drown in false-positive alerts and must prove an auditable, defensible decision for every flagged trade. **Economic stake:** banks have paid **$1B+** in spoofing/manipulation settlements; surveillance analysts spend hours per alert and most alerts are false positives.

**Why it wins on the four judging criteria.**

| Criterion | How this design hits it |
|---|---|
| **Application of Tech (Band)** | Band is structurally load-bearing: every cross-desk handoff, the runtime specialist recruit, the Prosecution↔Defense exchange, and the human escalation are Band messages *of record*; the audit chain's leaves are Band message hashes; the Chinese wall is two Band identities + scoped rooms. Delete Band → the system cannot coordinate. |
| **Originality** | Un-collapsible: the agent set is **data-dependent** (you don't know which specialist until you see the order flow); an **adaptive adversary co-evolves** with the detector; two **independent ground-truth oracles** (backtest engine + deterministic rule engine) defeat "LLMs grading LLMs"; cross-model contest (frontier vs open) is visible on screen. |
| **Business Value** | A real regulated workflow with quantified ROI on screen from second 0: false-positive reduction %, analyst-hours saved per alert, novel rules auto-codified. |
| **Presentation** | A read-only trace viewer makes coordination *watchable*: a live agent-topology graph (a node turns **blue = waiting on Band**), per-agent model badges, a live rule registry, and a verdict timeline that flips PASS→FLAGGED. The wow moment (live rule INSERT) lands in <3 seconds. |

---

## 2. System Architecture

### 2.1 Topology (two desks, two Band identities, one coordination spine)

```
                         ┌──────────────────────────────────────────────────────────┐
                         │                    BAND  (coordination spine)             │
                         │  rooms · @mention routing · GET /peers + recruit ·         │
                         │  message lifecycle (/processing,/processed,/next) ·        │
                         │  HITL humans-as-peers · events = human-visible audit mirror│
                         └──────────────────────────────────────────────────────────┘
   R&D DESK  (Band identity A)                                  SURVEILLANCE DESK  (Band identity B)
 ┌───────────────────────────────┐      sanitized order-flow   ┌───────────────────────────────────────┐
 │ Adversary agent (Featherless)  │  ───── bridge (trusted) ───▶│ AnomalyDetector  (Featherless, cheap)  │
 │  proposes order-event sequence │      events only, no R&D    │   triages the event stream → smell      │
 │  ORACLE-1 rule engine MISS?    │      reasoning crosses      │            │                            │
 │  ORACLE-2 backtest P&L real?   │                             │ Investigator (Featherless)              │
 │  → confirmed NOVEL EVASION ────┼──── Band handoff (payload   │   features→pick specialist; GET /peers; │
 │                                │      of record) ───────────▶│   POST /participants  (runtime recruit) │
 └───────────────────────────────┘                             │            │                            │
                ▲                                               │ Specialist (Featherless, recruited)     │
                │ new rule (regression-gated)                   │   proposes contested rule INPUTS        │
                │                                               │            │                            │
 ┌───────────────────────────────┐                             │ Prosecution(AI/ML API) ⚔ Defense(F'less) │
 │  RULE REGISTRY (shared, R/O    │◀── codify on human-confirm ─│   debate SETS the ambiguous inputs      │
 │  to R&D)  parameterized        │                             │            │                            │
 │  templates + provenance        │                             │ ▼ DETERMINISTIC RULE ENGINE (oracle)    │
 └───────────────────────────────┘                             │   authoritative verdict + cited metric  │
                                                                │            │                            │
                                                                │ EscalationManager(AI/ML API) → HUMAN     │
                                                                │            │  hash-chained AUDIT LEDGER   │
                                                                └───────────────────────────────────────┘
                          all agents → on_action callback → EventBus(desk-tagged) → SSE
                                                   ▼
                    READ-ONLY TRACE VIEWER (Next.js):  topology graph · model badges ·
                    live rule registry · verdict timeline · persistent stats bar · ?replay=
```

### 2.2 Agents / stages (job · input → output · model)

**Surveillance desk (must ship — the product):**

| Agent | Job | Input → Output | Model (provider) |
|---|---|---|---|
| **AnomalyDetector** | High-volume triage of the order-flow stream; emits a "smell" score + features | `list[ExchangeOrder]` window → `{suspicious, features:{cancel_to_fill,depth_levels,self_match_ratio,…}}` | open 7–15B (**Featherless**) — continuous, cheapest |
| **Investigator** | Opens a case; computes features; **selects + recruits** the right specialist at runtime | features → `case_id` + chosen specialist handle + Band recruit | open 7–15B (**Featherless**) |
| **Specialist** (spoofing / layering / wash-trade / marking) | Domain expert; proposes the **contested rule inputs** (bona fide vs spoof, window, intent) | case events → candidate inputs + rationale | open model (**Featherless**) |
| **Prosecution** | Argues the inputs that maximize the manipulation reading | case + candidate inputs → prosecution dossier (2-sentence headline + detail) | **frontier (AI/ML API)** — visible badge |
| **Defense** | Argues bona-fide / exonerating inputs | case + candidate inputs → defense dossier | **strong open (Featherless)** — visible badge |
| **Adjudicator** (thin) | Picks the contested-input values from the debate; feeds them to the engine | two dossiers → `resolved_inputs` | deterministic + 1 cheap LLM call |
| **Rule engine** (not an LLM) | Authoritative verdict on resolved inputs; also the label generator | events + resolved_inputs + active rules → `Verdict{PASS|FLAG, rule_id, metric}` | pure Python |
| **EscalationManager** | Builds the human packet; on rules-miss escalates; on human-confirm triggers codification | verdict + dossiers → escalation + (optional) `rule_codified` | **frontier (AI/ML API)** — synthesis quality |

**R&D desk (thin-but-real adversary):**

| Agent | Job | Input → Output | Model |
|---|---|---|---|
| **Adversary** | Proposes an order-event sequence to evade the *current* registry | active rules + market context → `list[ExchangeOrder]` (parameterized: timing, cancel ratio, sizes) | open model (**Featherless**) — many cheap iterations |
| **Oracle-1 (rule engine)** | Does the current registry MISS it? | sequence → evades? | pure Python (same engine) |
| **Oracle-2 (backtest)** | Is it economically real manipulation (price impact / P&L)? | sequence → profitable? | `quant_arena/backtest_engine.py` (runs outside Docker — safe) |

### 2.3 Orchestration / control flow & termination

A case is a **state machine** persisted in the Surveillance ledger and mirrored to Band. Every transition is bounded — no transition can wedge the demo:

```
OPEN ──(AnomalyDetector: suspicious)──▶ UNDER_REVIEW
UNDER_REVIEW ──(rule engine: known pattern)──▶ FLAGGED            # Beat A: instant
UNDER_REVIEW ──(rules miss; debate ≤ N rounds)──▶ ESCALATED      # Beat B: novel
UNDER_REVIEW ──(timeout T)──▶ CLOSED(timeout)                    # safety valve
ESCALATED ──(human: confirm)──▶ codify_rule → REGRESSION_GATE → FLAGGED → CLOSED(confirmed)
ESCALATED ──(human: reject)──▶ CLOSED(dismissed)
```

- **Prosecution/Defense** exchange is capped at **N rounds** (default 1–2), then the Adjudicator forces resolution → the engine adjudicates. No open-ended chatter.
- **R&D** is bounded to **K rounds** or "first round with no sequence that both evades and profits."
- **REGRESSION_GATE**: after codifying a rule, replay the evasion through the *new* registry and `assert verdict == FLAG`. The on-screen PASS→FLAGGED flip *is* this gate firing — proof the loop tightened.

### 2.4 Shared state & memory

- **System of record (compliance) = the Surveillance hash-chained ledger** (local SQLite + append-only JSONL). Track 3's deliverable.
- **Coordination of record = Band.** Each handoff payload rides *inside* the Band message body (JSON-in-`@mention`); the ledger stores `sha256(message_content)` + `band_message_id` + `room_id`. Case↔room binding uses Band's first-class `task_id`.
- **Cross-desk channel = one sanitized bridge** publishing order-flow events into a Surveillance-only room. R&D's *reasoning* never crosses. The **rule registry** is the only thing R&D reads back (read-only), surfaced as a Band Memory record / small read endpoint.
- **Capability registry is external** (Band peers carry no capability metadata): a small table mapping specialist → handle → order-flow-feature trigger.

### 2.5 How this evolved from the arenas

| Concern | Arena origin | Evolution |
|---|---|---|
| Per-agent ReAct loop | `trader-arena/arena/agent/loop.py:104` (`AgentLoop`, `on_action` hook) | Instantiate one per Surveillance agent; `on_action` → EventBus + ledger |
| Handoff seam | `info-biz-arena` in-process `runner.run()` (`decision_loop.py:415`) | Replaced by **BandHandoff** network round-trip (the one net-new seam) |
| Audit trail | `info-biz-arena/.../logging/trace.py` (Pydantic models; **hash fields exist, computation does not**) | Lift ~5 models; **add** SHA-256 + `prev_hash` chain + `verify_chain()` |
| LLM-judge | `info-biz-arena/.../eval/scorecard.py` | Reused as the escalation/quality gate (swap rubric) |
| Order-flow types | `trader-arena/arena/exchange/contracts.py:93` (`ExchangeOrder`, `Side`, `OrderStatus.CANCELLED`) | Reuse **contracts only**; cut MatchingEngine/OrderBook/PaperExchange |
| Live stream + UI | `prediction-arena/.../core/events.py` (EventBus) + Next.js SPA | EventBus + 3 new panels; **one** bus with a `desk` field (not two) |
| R&D oracle | `quant_arena/.../backtest_engine.py:59` (runs outside Docker) | P&L/impact check on the event sequence — **no code-gen, no Docker** |

---

## 3. Sponsor Tech Mapping + Cost Budget

### 3.1 Sponsor Tech Mapping (component → platform → *why this is the correct platform*)

| Component | Platform | Why this platform (not "because we have credits") | Wrong-platform trap to avoid |
|---|---|---|---|
| Cross-desk handoff, runtime recruit, Prosecution↔Defense exchange, HITL escalation, audit-of-record | **Band** (required) | This *is* multi-agent coordination across two isolated identities; Band is the only layer giving rooms + `@mention` isolation + peer recruit + humans-as-peers. It must be the spine for criterion 1. | Don't let the local ledger become the real coordinator — payloads must ride in Band messages. |
| **Prosecution** + **EscalationManager** synthesis (+ optional 2nd frontier role) | **AI/ML API** ($10, per-token, OpenAI-compat `…/v2`) | Reasoning quality is *visible and decisive* here; AI/ML API gives many frontier models behind one key → showcases **model orchestration** for its prize. | Don't burn the $10 on high-volume inner-loop steps. |
| **AnomalyDetector** triage, **Investigator**, **Specialists**, **Defense**, **R&D adversary** iterations | **Featherless** ($25, flat-rate unlimited tokens, 4 concurrent) | High-volume / many-iteration open-model steps; flat-rate makes token volume free → showcases **meaningful open-model use** for its prize. | Don't exceed 4 concurrent slots (HTTP 429); gate with a semaphore and stage calls. |
| R&D profitability oracle | local (`backtest_engine.py`) | Deterministic ground truth; no LLM, no cost, no Docker. | Don't reach for the Docker sandbox or an LLM "judgement" of profitability. |
| Deterministic rule engine | local (pure Python) | The verdict must be un-overrulable by any LLM — the second independent oracle. | Don't let a model decide the verdict. |

**Deliberate partner-prize hits.** *AI/ML API prize* (model orchestration/reasoning): the visible **Prosecution (frontier) vs Defense (open)** contest plus AI/ML API also running the EscalationManager synthesis on a second frontier model = multi-model orchestration on screen and in code. *Featherless prize* (open-model in a real agent system): five open-model roles do real, load-bearing work (triage, recruit, specialist analysis, defense, adversary). Model badges in the viewer name the exact models so judges who never open the code still see both sponsors.

### 3.2 Provider wiring (verified — not one-line; build a factory)

```python
# providers.py — inject api_base + key per provider; arena code is litellm already.
PROVIDERS = {
  "aimlapi":     {"prefix": "aiml",            "api_base": "https://api.aimlapi.com/v2",
                  "key_env": "AIML_API_KEY"},          # /v1 is embeddings/images only!
  "featherless": {"prefix": "featherless_ai",  "api_base": None,   # litellm default
                  "key_env": "FEATHERLESS_AI_API_KEY"},
}
# litellm.completion(model="aiml/<verified-id>", api_base=..., api_key=...)
# litellm.completion(model="featherless_ai/Org/ModelName", api_key=...)
# Day-0: confirm the exact AI/ML API model IDs with a live test call — do NOT hardcode
# an unverified "claude-opus-4-8"; use whatever the catalog resolves (a Claude Opus 4.x + a GPT-5.x).
```

### 3.3 Cost budget (fits with margin; concurrency is the real constraint, not $)

| Platform | Credit | Unit | Demo-run estimate | Hackathon-week estimate | Verdict |
|---|---|---|---|---|---|
| **Band** | Free (`BANDHACK26`, 1 mo Pro) | — | $0 | $0 | ✅ |
| **Featherless** | $25 Premium | flat-rate, **unlimited tokens**, 4 concurrent | $0 marginal | $25 (the subscription) | ✅ token volume is free; stay ≤4 slots |
| **AI/ML API** | $10 | per-token | ~5 frontier calls ≈ 30k in + 8k out ≈ **$0.20–0.50/run** | reserve paid frontier for final recordings + live demo (<15 runs ≈ **<$6**); rehearse on free Nemotron Nano / Featherless | ✅ within $10 |

**Cost controls:** rehearse on free models (AI/ML API's Nemotron Nano = $0, or Featherless), spend the metered $10 only on the final video recording + the live demo; `asyncio.Semaphore(4)` on all Featherless calls; never overlap the Prosecution/Defense beat with pre-scanner/specialist calls. **Budget-out fallback:** if the $10 runs dry mid-event, repoint Prosecution/EscalationManager to a free AI/ML API model or a Featherless frontier (DeepSeek-V3) — one config line; the demo's cross-model *story* still holds via the badges.

*Sources:* Band docs (`docs.band.ai/api/introduction`, `/api/agent-api`, `/core-concepts/chat-rooms`, `/integrations/custom-integration`); AI/ML API (`aimlapi.com/ai-ml-api-pricing`, `docs.litellm.ai/docs/providers/aiml`); Featherless (`featherless.ai/docs/plans`, `/docs/concurrency-limits`, `/docs/quickstart-guide`).

---

## 4. Tech Stack

- **Language/runtime:** Python 3.11+ (arena code is 3.11+; Band SDK requires 3.11+).
- **Agents:** litellm tool-calling loops (reused from `trader-arena`/`quant_arena`), models routed to AI/ML API + Featherless via the provider factory.
- **Coordination:** Band — REST (`https://app.band.ai/api/v1/agent/...`) + WebSocket (Phoenix Channels, `wss://app.band.ai/api/v1/socket/websocket`). Transport via `band-sdk` (`pip install band-sdk`) custom-integration path / `ThenvoiLink`, **else** a hand-rolled Phoenix client (budgeted Day-0).
- **Backend:** FastAPI (matches `prediction-arena`); SSE for the live stream; `asyncio`.
- **State:** local **SQLite** per desk + append-only **JSONL** ledger (no Postgres). Band Memory for the shared rule registry + capability hints.
- **Rule engine + generators:** pure Python; reuse `trader-arena/.../exchange/contracts.py` only.
- **R&D oracle:** `quant_arena/.../backtest_engine.py` (no Docker).
- **Frontend:** the `prediction-arena` Next.js 15 SPA (recharts + tailwind + Radix) + 3 new panels + a topology graph + a stats bar; **one** EventBus + **one** `/stream` SSE endpoint with a `desk` field; `?replay=<case>` mode.
- **Infra:** local for the live multi-process loop; **deployed read-only frontend (Vercel) + a tiny FastAPI replay backend (Render/Railway/Fly)** serving the recorded SSE — this is the submitted **Application URL** (always works for judges).

---

## 5. Data Flow — one task end-to-end

1. **Inject.** The sanitized bridge publishes a window of `ExchangeOrder` events (place/modify/cancel, timestamps, trader id) into the Surveillance Band room. (Beat A: a known clean layering pattern; Beat B: R&D's confirmed novel evasion.)
2. **Triage.** `AnomalyDetector` (Featherless) scores the window → `{suspicious, features}` → publishes a Band event (audit mirror) + EventBus (`desk=surveillance`).
3. **Open + recruit.** `Investigator` creates a Band room (`task_id=case-42` ↔ ledger `OPEN`), computes features, selects the specialist by trigger (e.g. `cancel_to_fill > 0.7` → spoofing), `GET /agent/peers` → `POST /chats/{room}/participants` → `@mention` handoff. *(Topology node turns **blue** = waiting on Band; the recruited edge draws in.)*
4. **Specialist + debate.** Specialist proposes contested inputs. `Prosecution` (AI/ML API frontier) and `Defense` (Featherless open) argue the inputs for ≤N rounds (2 speech-bubble cards, model badges). `Adjudicator` resolves the inputs.
5. **Verdict (oracle).** The **deterministic rule engine** evaluates resolved inputs against the **active registry**:
   - **Beat A:** known pattern → `FLAG` + `rule_id=FINRA-5210-layering`, cited metric → ledger `FLAGGED`. Instant.
   - **Beat B:** all active rules `PASS` (the 400 ms variant slips them) → ledger `ESCALATED`.
6. **Escalate (HITL).** `EscalationManager` (AI/ML API) builds the packet; `@mention`s the **human compliance officer** (Band peer) with both dossiers + the audit link. Human clicks **Confirm: Manipulation**.
7. **Codify + regression-gate (the wow).** On confirm: derive a new parameterized rule (`layering-v2: window_ms=400, min_cancel_ratio=0.80, provenance=human:compliance/case-42`) → INSERT into the registry (Band Memory + on screen) → **regression gate** replays the evasion → `assert FLAG` → case flips **PASS→FLAGGED**; `Active Rules 3→4`.
8. **Audit.** Every step appended to the hash-chained ledger (`prev_hash`→`hash`), each entry binding its `band_message_id`. `verify_chain()` is demonstrable.
9. **Co-evolve.** R&D reads the updated registry; its next adversary round must beat `layering-v2`.

---

## 6. Key Implementation Details (the hard / novel parts)

### 6.1 BandHandoff — the one network seam
```python
# band_handoff.py  — agents stay litellm; this is the ONLY networked module.
ENVELOPE = {                      # JSON-in-@mention (events can't trigger agents; messages do)
  "v": 1, "msg_id": "<uuid4>",    # idempotency key — Band provides none
  "case_id": "case-42",           # == Band room task_id
  "from": "investigator", "to": "spoofing_specialist",
  "kind": "handoff|evidence|verdict|escalation|rule_codified",
  "payload": { ... },             # the ARTIFACT OF RECORD, not a ping
}
# SEND:  POST /api/v1/agent/chats/{room}/messages
#        {"message":{"content": f"@{to} " + json.dumps(env), "mentions":[peer]}}
# RECV (Phoenix WS message_created):  POST /messages/{id}/processing
#        → parse env → if seen(msg_id): /processed; skip   (idempotent)
#        → run litellm agent → POST /messages/{id}/processed
#        → EventBus.publish(desk=...) ; ledger.append(sha256(content), band_message_id)
# STARTUP: drain backlog GET /agent/chats/{id}/messages/next until 204 (crash recovery)
```
Critic note: this is a **control-flow rewrite**, not a wrapper (the old seam was synchronous in-process). Build it **first against a mock-Band loopback** (an in-process asyncio queue mimicking the @mention round-trip) so the whole choreography is testable by Day 3 without the real WebSocket; wire real Phoenix last behind a flag.

### 6.2 Deterministic rule engine — verifier *and* label generator
```python
@dataclass(frozen=True)
class Rule:
    id: str; family: str                 # spoofing|layering|wash_trade|marking
    params: dict                         # {"window_ms":100,"min_cancel_ratio":0.8}
    provenance: str                      # "FINRA-5210" | "human:compliance/case-42"
    status: str = "ACTIVE"

def evaluate(events, resolved_inputs, registry) -> Verdict:
    # pure deterministic math per family on place/modify/CANCEL sequences
    # (order-to-trade ratio, cancel timing vs opposite-side fills, sub-best-bid layering,
    #  self-match ratio). Returns Verdict{PASS|FLAG, rule_id, cited_metric}.
```
Curate a **handful** of real FINRA-5210 / SEC-10b-5 patterns (a half-day). The engine both *creates* labeled scenarios and *renders* verdicts — the second oracle.

### 6.3 Debate sets inputs (load-bearing, not theater)
The engine is authoritative, but its **ambiguous inputs** — which contested orders are bona fide vs. spoof, the effective window boundary, intent — are exactly what it can't derive. Prosecution argues inputs that maximize manipulation; Defense argues exoneration; the Adjudicator picks; the engine then decides on those inputs. The debate **materially moves the verdict via the inputs**, with no LLM grading an LLM.

### 6.4 Runtime recruiting (data-driven, ≥4 specialists)
```python
SPECIALISTS = {  # external registry — Band peers carry no capability metadata
 "spoofing":  {"handle":"@spoof-spec", "trigger": lambda f: f.cancel_to_fill > 0.7},
 "layering":  {"handle":"@layer-spec", "trigger": lambda f: f.depth_levels >= 3},
 "wash_trade":{"handle":"@wash-spec",  "trigger": lambda f: f.self_match_ratio > 0.5},
 "marking":   {"handle":"@mark-spec",  "trigger": lambda f: f.eod_print_spike},
}  # Investigator: features → pick → GET /peers → POST /participants → @mention
```
Selection depends on *features of the order flow*, so it can't collapse into one fixed prompt.

### 6.5 Tamper-evident audit (lift schema, add the chain)
```python
def append(entry: dict, prev_hash: str) -> str:
    body = canonical_json(entry); h = sha256((prev_hash + body).encode()).hexdigest()
    jsonl.write({**entry, "band_message_id": entry["bmid"], "prev_hash": prev_hash, "hash": h})
    return h
def verify_chain(path) -> bool: ...   # recompute every link; tamper-evident
```
~5 Pydantic classes copy from `trace.py`; the chain + `verify_chain()` are the net-new, high-signal part.

### 6.6 Replay (= the submission video + the live fallback)
Every EventBus event is also appended to `events-<case>.jsonl` at real timestamps. `?replay=case-42` streams that JSONL over SSE at original cadence — pixel-identical to live. Run **live for Beat A** (fast, deterministic), **switch to replay for Beat B** the instant any agent step exceeds 15 s.

### 6.7 Prompt strategy / retries
- Each agent has a tight role system prompt + a 2-sentence-headline output contract (keeps the debate legible on screen).
- Tool-calling loops reuse the arena `tool_caller` plumbing (crash recovery, context compaction, cost tracking already built).
- Retries: litellm retry (already in the arena `LLMClient`) + Band message-lifecycle (`/failed` keeps a message redeliverable) + idempotent inbound by `msg_id`.

---

## 7. Build Plan (6 days, team of ~5) — with progress tracker

**Roles:** **B1 Integration** (BandHandoff + transport, the critical path), **B2 Surveillance** (agents + choreography), **B3 Rules/Data** (rule engine + generators + R&D oracle), **B4 Frontend** (viewer + panels + replay), **B5 Audit/Demo** (ledger + hash chain + deploy + video/pitch). Lead steers + owns the integration glue.

> Critical path = **B1**. The rule engine (**B3**) is built first/standalone (pure math, no deps) to unblock everyone. Choreography (**B2**) is built against the **mock-Band loopback** so it doesn't wait on real Phoenix.

### Day 0 (Jun 13) — de-risk the unknowns
- [ ] Confirm Band/AI-ML/Featherless credits **activated**; grab promo `BANDHACK26`.
- [ ] **Band transport spike:** 2 trivial agents send a structured `@mention` round-trip via `band-sdk` custom path *or* a hand-rolled Phoenix client; prove receive + `/processing`/`/processed`.
- [ ] **Verify exact AI/ML API model IDs** with a live `litellm.completion` test (`aiml/…`, base `…/v2`); pick the Prosecution frontier + an open Defense on Featherless.
- [ ] Repo scaffold (MIT license), env wiring, provider factory.

### Day 1–2 — foundations in parallel
- [ ] **B3:** rule engine (spoofing/layering/wash math) + `Spoofing/Layering/WashTradeGenerator` emitting labeled `ExchangeOrder` sequences (reuse `contracts.py` only). *Doubles as label generator.*
- [ ] **B1:** BandHandoff envelope + **mock-Band loopback**; idempotency/dedup; ledger write hook.
- [ ] **B5:** lift `trace.py` models; implement SHA-256 `prev_hash` chain + `verify_chain()`.
- [ ] **B4:** stand up the `prediction-arena` SPA; one EventBus + `/stream` with `desk` field.

### Day 3 — choreography end-to-end on the mock
- [ ] **B2:** AnomalyDetector → Investigator → recruit → Specialist → Prosecution/Defense → Adjudicator → rule engine → EscalationManager, all over the **mock loopback**, against B3's scenarios.
- [ ] **B1:** swap mock → **real Band** for the Surveillance desk; two Band identities; sanitized bridge.
- [ ] **B4:** topology graph (blue=waiting-on-Band) + model badges wired to EventBus.

### Day 4 — close the loop + R&D + frontend panels
- [ ] **B3:** R&D adversary (Featherless) + Oracle-1 (rule miss) + Oracle-2 (`backtest_engine.py`); regression gate.
- [ ] **B2/B5:** codify-on-confirm path; case state machine + timeouts.
- [ ] **B4:** live rule-registry table + verdict timeline (PASS→FLAGGED) + `Active Rules` counter + stats bar.

### Day 5 — integration, replay, deploy
- [ ] Full two-desk run; record Beat B ~10× → keep the cleanest as the **video** + `?replay` JSONL.
- [ ] Deploy read-only frontend (Vercel) + replay backend → the submitted **Application URL**.
- [ ] `verify_chain()` demo; HITL human peer wired.

### Day 6 (deadline Jun 19 15:00 UTC) — polish + submit early
- [ ] Rehearse the 90-second script with the replay fallback armed.
- [ ] Cover image, slide deck, short/long descriptions, tech/category tags.
- [ ] **Submit by morning** — avoid the deadline crush.

### MVP vs Stretch
- **MVP (all four criteria):** Surveillance choreography over real Band (Surveillance identity) · deterministic rule engine + scripted labeled scenarios · runtime recruit (fixed-if-needed) · Prosecution(AI/ML API) vs Defense(Featherless) · HITL confirm → **live rule INSERT + PASS→FLAGGED** · hash-chained ledger · viewer (topology, badges, rule table, timeline, stats) · deployed replay URL.
- **Stretch (only if MVP green by Day 4):** genuine runtime self-nomination; a second *ambiguous* case where Prosecution/Defense visibly disagree; R&D running fully live on stage (otherwise pre-baked transcript + live codify animation).
- **Cut order under pressure:** (1) Postgres → already cut. (2) CLOB matching engine + OHLCV bridge → already cut. (3) live R&D on stage → pre-baked transcript + live codify. (4) 2nd SSE endpoint → one bus + `desk` field. (5) extra specialists → keep 1–2.

---

## 8. Risks & Mitigations

| # | Risk | Type | Mitigation / fallback |
|---|---|---|---|
| 1 | **Band transport (Phoenix WS) eats days** | Integration | Day-0 spike; prefer `band-sdk` custom path; **mock-Band loopback** decouples all other work; real WS behind a flag. If WS never lands: REST-poll `/messages/next` (degraded but real handoffs). |
| 2 | **Band looks like "just a chat bus"** | Architecture/scoring | Payloads ride *in* Band messages; ledger stores their hashes; case↔room via `task_id`; topology graph shows the **blue waiting-on-Band** state. Delete-Band test fails by design. |
| 3 | **Chinese wall leaks** (humans see all; peers discoverable) | Architecture | **Two Band identities**; sanitized one-way bridge; separate human peers/rooms per desk; documented threat model. |
| 4 | **Featherless 429 (4-slot cap)** | Integration | `asyncio.Semaphore(4)`; ≤32B where possible; stage calls so the debate never overlaps pre-scanner/specialists; request Agent-Standard (8-slot) sponsor credit if offered. |
| 5 | **Unverified model ID 404 on camera** | Integration | Day-0 live test of exact AI/ML API IDs; badges name confirmed models; free Nemotron Nano fallback. |
| 6 | **Loop wedges / no termination** | Technical | Explicit state machine with **timeout** transitions; debate round cap; R&D round cap; regression gate asserts the new rule trips. |
| 7 | **Debate is decorative** | Originality | Debate **sets the rule-engine inputs**; ≥4 feature-triggered specialists → data-driven, not one prompt. |
| 8 | **Live multi-process demo stalls** | Demo-day | `?replay` SSE fallback (pixel-identical); live Beat A, replay Beat B on >15 s; the recorded run *is* the submission video. |
| 9 | **Reuse over-optimism / time** | Time | Spot-checked: keep `contracts.py`, EventBus, `backtest_engine.py`, agent loops; **throw away** `store.py` (40 methods), CLOB engine, Docker sandbox. |
| 10 | **$10 AI/ML API runs dry** | Cost | Rehearse on free models; one-line repoint to free/Featherless frontier; badges keep the cross-model story. |

---

## 9. Deliverables Checklist (from the PDF §10) — mapped to owner

| Requirement | Owner | Artifact |
|---|---|---|
| Public **GitHub repo**, original, **MIT** | B5 + all | the monorepo |
| **Demo application platform + Application URL** | B4/B5 | deployed Vercel viewer + replay backend (`?replay=case-42`) |
| **Video demo** | B5 | the cleanest recorded Beat-A→B→audit run (90 s) |
| **Cover image** | B5 | topology + "system that learns from its own adversary" |
| **Slide presentation** | Lead/B5 | problem · architecture (Band spine) · 4-criteria map · ROI · sponsor use |
| Project **title + short + long description** | Lead | "Alpha & Oversight — adversarial trade-surveillance coordinated through Band" |
| **Tech & category tags** | Lead | Track 3; Band, AI/ML API, Featherless, multi-agent, compliance |
| Partner-prize evidence (AI/ML API + Featherless) | B1/B3 | named model badges on screen + a "sponsor usage" slide |

---

## 10. Demo & Pitch Strategy (2–3 min)

**The story:** *"AI trading strategies are getting good at manipulation — and at hiding it. Alpha & Oversight red-teams its own detector against an adversarial AI quant and gets smarter every round, coordinated entirely through Band, with a human and an immutable audit trail in the loop."*

**On screen the whole time:** a **stats bar** — `ALERTS: 847 | FALSE POSITIVES BLOCKED: 72% | ANALYST-HOURS SAVED: 41.2 | NOVEL RULES: 0` — and an **`Active Rules: 3`** counter. These carry Business Value from second 0.

**90-second beat sheet** (live Beat A; replay-armed Beat B):

| t | Screen | Narration |
|---|---|---|
| 0:00–0:08 | Dashboard; topology grey; registry 3 rows | "A system that red-teams its own detector against an adversarial AI quant — and gets smarter every round." |
| 0:08–0:22 | R&D card "Strategy v1 → submitted"; AnomalyDetector pulses; **FLAGGED — FINRA 5210, cancel ratio 86%/100ms** | "Known pattern, instant verdict. The deterministic engine cites the regulation and blocks it." |
| 0:22–0:36 | "Strategy v2 → submitted"; rule engine silent; **PASS** | "The quant widened the cancel window to 400 ms. Same economics, different timing. Every rule stays silent." |
| 0:36–0:52 | Investigator node → **BLUE (waiting on Band)**; specialist self-nominates; edge draws in | "It doesn't know which specialist to call — so it asks Band's registry. A layering specialist is recruited. **Band routed that handoff, not our code.**" |
| 0:52–1:10 | Two badges side by side — **Prosecution [Claude / AI/ML API]** vs **Defense [open / Featherless]** | "Prosecution argues economic equivalence on a frontier model; Defense argues legitimate order management on an open model. Two models, one human decision." |
| 1:10–1:32 | Human clicks **Confirm**; **registry row INSERTs**, `Active Rules 3→4`, case **PASS→FLAGGED** — all <3 s | "One click. New rule codified. **The system just made itself harder to evade.**" |
| 1:32–1:45 | Audit lineage; SHA-256 hashes; `verify_chain ✓` | "Every step is immutable and auditable. The regulator doesn't have to trust us — they can verify the chain." |
| 1:45–2:00 | Stats bar prominent; Band highlighted as the spine | "72% fewer false positives, 41 analyst-hours saved — discovery to new rule in under a minute. Coordinated entirely through Band, not a wrapper." |

**The one moment judges remember:** `Active Rules 3→4` + row highlight + PASS→FLAGGED, simultaneously, under three seconds, on *"made itself harder to evade."* It must be **causally automatic** within 3 s of the human click — never two manual steps bridged by words.

**Live vs pre-recorded:** live Beat A (deterministic, safe); replay Beat B on any >15 s stall; the recorded clean run is the submission video; the deployed `?replay` URL is the Application URL that always works for judges.

---

## What to build first (start coding now)
1. **Rule engine (B3)** — pure Python spoofing/layering/wash math + labeled-scenario generators (reuse `contracts.py`). No deps; unblocks everyone; is the second oracle.
2. **Band transport spike (B1)** — 2 agents, structured `@mention` round-trip + `/processing`/`/processed` via `band-sdk` custom path or hand-rolled Phoenix; then the **mock-Band loopback**.
3. **Hash-chained ledger (B5)** — lift `trace.py` models; add `prev_hash` chain + `verify_chain()`.
4. **Viewer skeleton (B4)** — `prediction-arena` SPA up; one EventBus + `/stream` (`desk` field); topology graph stub with the blue state.
5. **Choreography on the mock (B2)** — wire the Surveillance agents end-to-end against the loopback + B3 scenarios, then swap to real Band.

*Verification gates:* Day-0 spike proves Band send+receive; Day-3 proves the full choreography on the mock; Day-4 proves codify→regression-gate flips PASS→FLAGGED; Day-5 proves `verify_chain()` + the deployed replay URL.
