# Alpha & Oversight — BUILD BLUEPRINT (durable build spec)

**Audience:** build/critic subagents. **Source of truth for the build.** Reconciled against `docs/design.md` (the locked architecture). Read this fully before writing code.

**What we're building:** an adversarial trade-surveillance system. Two desks coordinate THROUGH Band: an R&D adversary proposes order-event sequences that evade detection + are economically real; a Surveillance desk (AnomalyDetector → Investigator → runtime-recruited Specialist → Prosecution⚔Defense debate that SETS contested inputs → a DETERMINISTIC rule engine renders the authoritative verdict → EscalationManager → human) catches them. On human-confirm a new rule is codified live + a regression gate asserts the evasion now trips. Everything is recorded in a hash-chained audit ledger whose leaves are Band message hashes.

## Conventions (ALL agents follow)
- **Python 3.11+**. One repo venv at `alpha-oversight/.venv` (created in Phase 0). Use `.venv/bin/pip` and `.venv/bin/pytest` for everything. **Phase 1+ agents: deps are already installed — do NOT `pip install`; if something's missing, report it.**
- **TDD**: write test → run (fail) → implement → run (pass). Keep files focused (<~200 LOC).
- **All LLM calls are MOCKED in tests** via a `FakeGateway` / monkeypatched `litellm.acompletion` returning canned, schema-valid JSON. **Never call a live API.** Band transport in tests = `MockBand` (in-process).
- Every COPIED reuse file gets a header: `# LIFTED FROM <repo>/<path>:<line> — <note>`.
- **Never add `Co-Authored-By: Claude`** to any commit.
- Karpathy guidelines: surgical changes, no overcomplication, surface assumptions, verifiable goals.

---

## §0 Reuse source pointers (read these files; copy/extend/strip as noted)
Reuse repos live under `/home/pratham/raeth_github/`.

| Copy target | Source (read it) | Notes |
|---|---|---|
| `reused/agent_loop.py` | `trader-arena/arena/agent/loop.py:104` | `AgentLoop(model_key, system_prompt, tool_registry, max_iterations=20, on_action=None)` → `async run_turn(user_prompt)->AgentResult`. Owns JSON extraction + forced-final-JSON round. `_emit_action` (loop.py:505) is the event hook. `AgentResult` @dataclass: `parsed:dict|None, raw_text, actions:list[AgentAction], iterations, token/cost accumulators`. Imports `MODELS` from gateway — keep together. |
| `reused/tool_registry.py` | `trader-arena/arena/agent/tools/base.py:50` | **LIFT VERBATIM.** `ToolDefinition`(@dataclass name/description/parameters/.to_dict()), `ToolResult`(@dataclass **success/data/error** — NOT Pydantic), `ToolRegistry`(register/definitions()->list[dict]/has_tools/execute(name,args)->ToolResult). The loop reads `result.success/.data/.error`. Do NOT substitute prediction-arena's Pydantic toolkit. |
| `reused/gateway.py` + `reused/cost_tracker.py` | `trader-arena/arena/llm/gateway.py` + `arena/llm/cost_tracker.py:24` | `LLMGateway`(line 158) + module `MODELS:dict[str,ModelSpec]`. Calls `litellm.acompletion(model=spec.litellm_model, messages, max_tokens, temperature, response_format=...)`; `litellm.drop_params=True`. Today routes ALL via OpenRouter, NO per-call api_base. Retries w/ backoff (gateway.py:256). XML tool-call fallback (gateway.py:564). **EXTEND in Phase 1B** (api_base/key_env + Semaphore). |
| `reused/events.py` | `prediction-arena/backend/src/core/events.py` | `EventBus`(subscribe/unsubscribe/publish(event)), in-mem asyncio.Queue maxsize=100 drop-oldest. `ActivityEvent` TypedDict{agent_name,model_id,content,reasoning,tool_calls,created_at}. **ADD `desk:str`.** |
| `reused/compaction.py` | `prediction-arena/backend/src/core/agent/loop.py:41-81` | **LIFT VERBATIM** `_compact_old_tool_results` + wrap-up nudge + consts (`_COMPACT_AGE_TURNS=8,_COMPACT_SIZE_BYTES=2000,_WRAP_UP_THRESHOLD=10`). Turn-aware in-context compaction (memory L1). |
| `reused/trace_models.py` | `info-biz-arena/src/arena/logging/trace.py` | Lift 5 Pydantic models: `BudgetMutation,LLMCallTrace,ToolCallTrace,FairnessProof,CycleTrace`. **STRIP `DecisionTraceLogger`** (lines 217-498; aiofiles/structlog/StateStore deps). Hash fields are empty-string stubs — the real chain is built in `audit/ledger.py`. |
| `reused/eval_gate.py` | `info-biz-arena/src/arena/eval/scorecard.py` | EXTRACT `_eval_completion` + JSON fence-strip (~L833) + grade-threshold logic ONLY. Replace rubric strings. Used by EscalationManager. |
| `reused/quant/*` (7 files) | `quant_arena/src/simulation/{backtest_engine,market_simulator,cost_model,order_validator,portfolio}.py` + `src/contracts/{trading_contracts,data_contracts}.py` | `BacktestEngine(starting_capital,universe,seed,borrow_rate_bps=50).run(orders_by_day:dict[int,list[Order]], market_data:list[DayMarketData])->BacktestOutput`. Pure in-process, deps pydantic+numpy, NO Docker. quant `Order(instrument,side:Literal["BUY","SELL"],qty,order_type,limit_price,stop_price)` (frozen) — DIFFERENT from ExchangeOrder. `OHLCV(open,high,low,close,volume,vwap)`. `cost_model` has Almgren-Chriss `impact_bps=daily_vol*sqrt(participation)*1e4`. `BacktestOutput.trades[i]` keys incl `pnl_impact, slippage_bps`. Fix relative imports to the `reused.quant` package. |
| `contracts/exchange_contracts.py` | `trader-arena/arena/exchange/contracts.py` | Self-contained (stdlib+pydantic v2). `ExchangeOrder`(order_id,symbol,side:Side,quantity:int,order_type,limit_price,status:OrderStatus,filled_quantity,created_at,model_key,...), `Side{BUY,SELL}`, `OrderStatus{...,CANCELLED}`, `OrderType`, `TimeInForce`, `OrderFill`, `ModifyRequest`, `Quote`, `MarketDepth`. Copy `contracts.py` only; do NOT copy `__init__.py` or the heavy classes. |

**LEAVE BEHIND:** trader-arena `exchange.py`/`matching_engine.py`/`order_book.py`/`market_data.py`/`risk.py` (CLOB/Alpaca); info-biz `store.py` (1076 LOC/48 methods, Postgres) + `decision_loop.py`/`SkillRunner` (replaced by BandHandoff+EventBus) + Postgres `models.py`/`database.py`; quant `sandbox/`/`llm/`/`orchestrator/`/`data/`/`validation/code_validator.py`.

---

## §1 Repo directory tree
```
alpha-oversight/
  pyproject.toml  requirements.txt  .env.example  .env(skeleton,gitignored)  .gitignore  LICENSE(MIT)  Makefile  README.md
  backend/alpha_oversight/
    reused/        agent_loop, tool_registry, gateway, cost_tracker, events, compaction, trace_models, eval_gate, quant/
    contracts/     exchange_contracts(copy) · order_events(NET) · case_contracts(NET) · rule_contracts(NET) · band_envelope(NET)
    providers.py   structured.py
    rules/         engine · math_spoofing · math_layering · math_wash_trade · math_marking · registry · seed_rules · codify[P5]
    generators/    scenarios · backtest_adapter[P2]
    band/          transport(Protocol) · mock_band(DEFAULT) · handoff · bridge · phoenix_band[P7]
    memory/        scratchpad(SQLite) · prompt_sections
    audit/         ledger · canonical
    state/         case_store(SQLite) · state_machine
    agents/        base_agent + anomaly_detector,investigator,specialist,prosecution,defense,adjudicator,escalation_manager,adversary · specialist_registry
    orchestration/ surveillance_pipeline · rnd_loop[P5] · replay_writer
    server/        app(FastAPI) · routes_stream · routes_cases · routes_human · routes_demo
    config.py
  backend/tests/   conftest(MockBand+FakeGateway fixtures) + one test_*.py per module + test_choreography_e2e
  frontend/        [Phase 6 — deferred]
  scripts/         day0_provider_smoke · day0_band_spike · verify_chain · record_replay
  docs/            design.md · BUILD_BLUEPRINT.md · threat_model.md
```
`[P2]/[P5]/[P7]` = built in that phase; Phase 0 stubs everything through P4. P5–P7 modules: create the file with a stub only if an import needs it, else skip.

---

## §2 Interface contracts (signatures — implement EXACTLY; Phase 0 freezes these as stubs)

### providers.py
```python
# EXTEND ModelSpec (in reused/gateway or contracts/common) with: api_base: str|None=None ; key_env: str="OPENROUTER_API_KEY"
PROVIDERS = {
  "aimlapi":     {"prefix":"aiml",           "api_base":"https://api.aimlapi.com/v2", "key_env":"AIML_API_KEY"},
  "featherless": {"prefix":"featherless_ai", "api_base":None,                          "key_env":"FEATHERLESS_AI_API_KEY"},
}
FEATHERLESS_SEMAPHORE: asyncio.Semaphore   # = asyncio.Semaphore(4), module-level, shared by ALL featherless calls
def register_models() -> None: ...                 # insert demo ModelSpecs (AIML frontier + Featherless open) into MODELS
def resolve_call_kwargs(spec) -> dict: ...         # {"api_base":..,"api_key":os.environ[spec.key_env]} or {} for OpenRouter
def is_featherless(spec) -> bool: ...
# gateway EDIT: merge resolve_call_kwargs(spec) into every litellm.acompletion(...) site (gateway.py:207, loop.py:217, loop.py:407, structured.py); wrap featherless calls in `async with FEATHERLESS_SEMAPHORE:`
```
### structured.py
```python
T = TypeVar("T", bound=BaseModel)
async def structured_completion(messages: list[dict], schema: type[T], model_key: str, max_repair: int=1) -> T: ...
# litellm.acompletion(response_format={"type":"json_object"}, **resolve_call_kwargs); schema.model_validate_json(text);
# on ValidationError → append repair msg w/ schema.model_json_schema(); retry once; raise StructuredError on final fail.
```
### contracts/order_events.py
```python
class OrderAction(str,Enum): PLACE="PLACE"; MODIFY="MODIFY"; CANCEL="CANCEL"; FILL="FILL"
class OrderEvent(BaseModel): action:OrderAction; order:ExchangeOrder; timestamp:datetime; trader_id:str=""
```
### contracts/band_envelope.py
```python
class BandKind(str,Enum): HANDOFF="handoff"; EVIDENCE="evidence"; VERDICT="verdict"; ESCALATION="escalation"; RULE_CODIFIED="rule_codified"
class Envelope(BaseModel):
    v:int=1; msg_id:str=Field(default_factory=lambda:str(uuid4())); case_id:str
    from_:str=Field(alias="from"); to:str; kind:BandKind; payload:dict
    model_config=ConfigDict(populate_by_name=True)
    def to_mention(self)->str: ...          # f"@{self.to} " + self.model_dump_json(by_alias=True)
    @classmethod
    def parse_mention(cls, content:str)->"Envelope": ...   # strip leading @handle, json.loads rest
```
### contracts/rule_contracts.py + rules/engine.py
```python
class RuleFamily(str,Enum): SPOOFING="spoofing"; LAYERING="layering"; WASH_TRADE="wash_trade"; MARKING="marking"
@dataclass(frozen=True)
class Rule: id:str; family:RuleFamily; params:dict; provenance:str; status:str="ACTIVE"
class Verdict(BaseModel): result:Literal["PASS","FLAG"]; rule_id:str|None; cited_metric:dict|None
def evaluate(events:list[OrderEvent], resolved_inputs:"ResolvedInputs", registry:list[Rule]) -> Verdict: ...
def spoofing_metric(events, params)->tuple[bool,dict]: ...   # cancel timing vs opposite-side fills
def layering_metric(events, params)->tuple[bool,dict]: ...   # sub-best-bid depth levels
def wash_trade_metric(events, params)->tuple[bool,dict]: ...  # self-match ratio
def marking_metric(events, params)->tuple[bool,dict]: ...     # eod print spike
```
### rules/registry.py + rules/seed_rules.py
```python
class RuleRegistryStore:                  # SQLite-backed
    def __init__(self, db_path:str): ...
    def active(self)->list[Rule]: ...
    def codify(self, rule:Rule)->None: ... # INSERT, status ACTIVE
    def count(self)->int: ...
def seed_rules() -> list[Rule]: ...        # curated FINRA-5210 / SEC-10b-5 ACTIVE rules at boot
```
### generators/scenarios.py + generators/backtest_adapter.py  [adapter = P2]
```python
def clean_layering()->list[OrderEvent]: ...   # Beat-A known pattern (FLAGs)
def clean_spoofing()->list[OrderEvent]: ...
def clean_wash()->list[OrderEvent]: ...
def novel_layering_evasion()->list[OrderEvent]: ...   # Beat-B: 400ms variant that PASSes the seed rules
# backtest_adapter.py (P2):
def to_quant_orders(events:list[OrderEvent])->dict[int,list[QuantOrder]]: ...  # PLACE/FILL→Order, CANCEL skipped
def synth_market_data(symbols:list[str], days:int, seed:int)->list[DayMarketData]: ...
def is_profitable_and_moved(events:list[OrderEvent], seed:int=0)->bool: ...    # PnL>0 AND any slippage_bps>THRESH
```
### band/ (transport + handoff + bridge)
```python
class Inbound(BaseModel): band_message_id:str; room_id:str; content:str
class BandTransport(Protocol):
    async def send(self, room:str, env:Envelope, mention_peer:str)->str: ...   # -> band_message_id
    async def recv(self)->Inbound: ...
    async def mark_processing(self, msg_id:str)->None: ...
    async def mark_processed(self, msg_id:str)->None: ...
    async def drain_backlog(self)->AsyncIterator[Inbound]: ...
class MockBand(BandTransport): ...        # in-proc asyncio.Queue; same identity-pair semantics; DEFAULT
class PhoenixBand(BandTransport):         # [P7] real WS
    def __init__(self, base_url, api_key, ws_url, identity): ...
class BandHandoff:
    def __init__(self, transport:BandTransport, ledger:"Ledger", bus:"EventBus", desk:str): ...
    async def send(self, room:str, env:Envelope, peer:str)->str: ...   # send + ledger.append(sha256(content),bmid) + bus.publish(desk)
    async def pump(self, dispatch:Callable[[Envelope],Awaitable[None]])->None: ...
    #   recv→mark_processing→parse→if seen(msg_id):mark_processed;continue→dispatch→mark_processed→ledger.append→bus.publish(desk)
    def _seen(self, msg_id:str)->bool: ...   # idempotency set
class SanitizedBridge:
    def __init__(self, handoff:BandHandoff, surveillance_room:str): ...
    async def publish_flow(self, events:list[OrderEvent])->None: ...   # events ONLY; strips R&D reasoning (Chinese wall)
```
### memory/ (L2 + injection; L1=reused/compaction, L3=audit/ledger)
```python
class ScratchpadJournal:                   # aiosqlite, one row per case_id
    def __init__(self, db_path:str, case_id:str, model_key:str): ...
    async def update_scratchpad(self, content:str)->str: ...
    async def append_journal(self, entry:str)->str: ...
    async def get_recent_journal(self, max_chars:int=8000)->str: ...
    async def compact_journal(self)->str: ...
def build_sections(scratchpad:str, journal:str, case_brief:str)->str: ...   # named sections → user prompt
```
### audit/ledger.py + audit/canonical.py
```python
def canonical_json(obj:dict)->str: ...     # json.dumps(sort_keys=True, separators=(",",":"))
class Ledger:
    def __init__(self, jsonl_path:str, db_path:str): ...
    def append(self, entry:dict, prev_hash:str)->str: ...
    #   body=canonical_json(entry); h=sha256((prev_hash+body).encode()).hexdigest();
    #   write {**entry,"band_message_id":entry.get("bmid"),"prev_hash":prev_hash,"hash":h}; return h
    def head(self)->str: ...                # last hash, genesis "" if empty
    @staticmethod
    def verify_chain(jsonl_path:str)->bool: ...   # recompute every link; tamper-evident
```
### state/ (case state machine + store)
```python
class CaseState(str,Enum): OPEN="OPEN"; UNDER_REVIEW="UNDER_REVIEW"; FLAGGED="FLAGGED"; ESCALATED="ESCALATED"; CLOSED="CLOSED"
class Case(BaseModel): case_id:str; room_id:str; state:CaseState; features:dict; verdict:Verdict|None; created_at; updated_at
class CaseStore:                           # aiosqlite; case_id == band room task_id
    def __init__(self, db_path:str): ...
    async def create(self, case_id:str, room_id:str)->Case: ...
    async def get(self, case_id:str)->Case|None: ...
    async def transition(self, case_id:str, new_state:CaseState)->Case: ...
    async def list(self)->list[Case]: ...
def next_state(current:CaseState, trigger:str)->CaseState: ...   # raises on illegal; "timeout"→CLOSED
TIMEOUTS: dict[CaseState,float]            # bounded; demo cannot wedge
```
### reused/events.py (extension) + orchestration/replay_writer.py
```python
class ActivityEvent(TypedDict): agent_name:str; model_id:str; desk:str; content:str|None; reasoning:str|None; tool_calls:list[dict]; created_at:str
class ReplayWriter:
    def __init__(self, events_dir:str): ...
    async def tee(self, event:ActivityEvent)->None: ...    # append events-<case>.jsonl with wall-clock ts
async def stream_replay(case_id:str, events_dir:str)->AsyncIterator[str]: ...   # yield "data: {json}\n\n" at original cadence
```
### agents/ — base + 8 wrappers + registry
```python
class SurveillanceAgent:
    def __init__(self, model_key:str, system_prompt:str, registry:ToolRegistry, bus, ledger, desk:str): ...
    async def run(self, user_prompt:str, schema:type[T])->T: ...   # AgentLoop(...on_action=self._emit) → structured parse
```
| file | model tier (provider) | role | output schema |
|---|---|---|---|
| anomaly_detector | open 7-15B (Featherless) | triage stream; emit smell+features | `AnomalyOut{suspicious:bool, features:Features}` |
| investigator | open (Featherless) | open case; features→pick+recruit specialist | `InvestigationOut{case_id, specialist:str, rationale}` |
| specialist | open (Featherless) | propose contested rule inputs | `SpecialistOut{candidate_inputs:dict, rationale}` |
| prosecution | frontier (AI/ML API) badge | maximize manipulation reading | `Dossier{headline, detail, claimed_inputs}` |
| defense | strong open (Featherless) badge | argue bona-fide/exoneration | `Dossier{headline, detail, claimed_inputs}` |
| adjudicator | 1 cheap LLM call | pick contested-input values | `ResolvedInputs{window_ms, bona_fide_ids, intent}` |
| escalation_manager | frontier (AI/ML API) | build human packet; on-confirm trigger codify; uses eval_gate | `EscalationOut{packet, recommend, rule_codified:Rule|None}` |
| adversary [feeds P5] | open (Featherless) | evade current registry | `AdversaryOut{events:list[OrderEvent], params}` |
```python
# specialist_registry.py
SPECIALISTS = {
 "spoofing":  {"handle":"@spoof-spec","trigger":lambda f: f.cancel_to_fill>0.7},
 "layering":  {"handle":"@layer-spec","trigger":lambda f: f.depth_levels>=3},
 "wash_trade":{"handle":"@wash-spec", "trigger":lambda f: f.self_match_ratio>0.5},
 "marking":   {"handle":"@mark-spec", "trigger":lambda f: f.eod_print_spike},
}
def select_specialist(features:"Features")->tuple[str,str]: ...   # (family, handle); first matching trigger
```
### orchestration/surveillance_pipeline.py + server/
```python
async def run_surveillance(events:list[OrderEvent], handoff:BandHandoff, store:CaseStore, registry, bus, ledger) -> Case: ...
# detector→investigator→recruit(@mention via handoff)→specialist→Prosecution/Defense(≤N rounds, stage to respect Semaphore-4)→adjudicator→engine.evaluate→escalation; transitions persisted; replay tee'd.
# server/app.py: create_app()->FastAPI (lifespan: register_models(); seed→registry; app.state.{event_bus,case_store,registry,handoff})
# routes: GET /stream(SSE, desk, ?replay=) · GET /cases,/cases/{id},/cases/{id}/audit,/rules · POST /cases/{id}/confirm|/reject · POST /demo/beat-a|/beat-b · GET /stats
```

---

## §3 .env.example schema (Phase 0 writes; keys filled later)
```bash
AIML_API_KEY=
AIML_API_BASE=https://api.aimlapi.com/v2     # /v1 = embeddings/images only
AIML_FRONTIER_MODEL=                          # set later from live catalog; litellm "aiml/<id>". DO NOT hardcode unverified.
AIML_FRONTIER_MODEL_ALT=
AIML_FREE_MODEL=
FEATHERLESS_AI_API_KEY=
FEATHERLESS_OPEN_MODEL=                        # litellm "featherless_ai/Org/Model"
FEATHERLESS_DEFENSE_MODEL=
FEATHERLESS_MAX_CONCURRENCY=4
BAND_RND_API_KEY=
BAND_RND_AGENT_ID=
BAND_RND_ROOM=
BAND_SURV_API_KEY=
BAND_SURV_AGENT_ID=
BAND_SURV_ROOM=
BAND_API_BASE=https://app.band.ai/api/v1
BAND_WS_URL=wss://app.band.ai/api/v1/socket/websocket
BAND_HUMAN_PEER=
USE_REAL_BAND=false                           # false → MockBand (default this round)
LEDGER_DIR=./data/ledger
EVENTS_DIR=./data/events
CASE_DB=./data/cases.db
RULES_DB=./data/rules.db
MEMORY_DB=./data/memory.db
BACKEND_PORT=8000
FRONTEND_API_BASE=http://localhost:8000
```

---

## §4 Build DAG → phases (THIS RUN = 0–4). Each gate must pass before the next phase.
- **Phase 0 — Contract-first scaffold** (sequential): tree + venv + deps + reuse copies + every net-new module as a stub (Pydantic models/enums FULLY defined; bodies `raise NotImplementedError`) + config/.env/conftest(FakeGateway+MockBand). **GATE:** `.venv/bin/pytest --collect-only -q` passes; all imports resolve; `tool_registry.py` is trader-arena's dataclass-`ToolResult` version.
- **Phase 1 — Foundations** (parallel, disjoint dirs): 1A rules/+order_events+rule_contracts+scenarios · 1B providers+structured+gateway-edit · 1C band_envelope+band/(mock+handoff+bridge) · 1D audit/(canonical+ledger). **GATES:** per-module pytest (rule engine clean→PASS/spoof→FLAG; Semaphore caps at 4 + structured validate+repair; mock @mention round-trip + dup-msg_id dedup + publish carries `desk`; ledger chains + tamper→False).
- **Phase 2 — Backtest adapter** (sequential; needs 1A + reused/quant): generators/backtest_adapter. **GATE:** `pytest tests/test_backtest_adapter.py` (profitable seq→True, flat→False).
- **Phase 3 — Agents+state+memory** (parallel, disjoint dirs; needs 1A/1B/1C): 3A state/+case_contracts · 3B memory/ · 3C agents/(base+8+registry). **GATE:** `pytest tests/test_state_machine.py tests/test_specialist_select.py` + each agent.run() returns its schema vs FakeGateway.
- **Phase 4 — Choreography on mock** (sequential integrator; the milestone): orchestration/surveillance_pipeline+replay_writer + server/app + routes. **GATE:** `pytest tests/test_choreography_e2e.py` — Beat-A runs the full pipeline on MockBand → FLAGGED case + `verify_chain()==True` over that run's ledger.

**Deferred (NOT this run):** P5 rules/codify+regression+rnd_loop · P6 frontend · P7 phoenix_band+deploy+live model smoke.

---

## §5 Risk / sequencing notes (load-bearing)
1. **Two order types are a feature.** `ExchangeOrder` (int qty, `Side` enum, mutable, the Band/surveillance wire type) vs quant `Order` (frozen, `Literal` side, the backtest input). They meet ONLY in `generators/backtest_adapter.py`. Never unify; field-name drift (`quantity`/`qty`, `symbol`/`instrument`) silently corrupts the oracle.
2. **ToolRegistry reconciliation lands in Phase 0.** `AgentLoop` reads dataclass `ToolResult.success/.data/.error` and calls `.definitions()/.has_tools()/.execute()`. Wiring prediction-arena's Pydantic registry breaks at runtime, not import.
3. **api_base extension is invasive.** Centralize via `resolve_call_kwargs(spec)` and apply at ALL 4 acompletion sites (gateway.py:207, loop.py:217, loop.py:407, structured.py). A missed site silently 404s a frontier call.
4. **Semaphore-4 wraps Featherless at the call site**, shared process-wide; the pipeline also STAGES calls so Prosecution/Defense never overlap Detector/Specialist (5 featherless roles in parallel = instant 429).
5. **Mock-vs-real Band is one flag.** Everything depends on the `BandTransport` Protocol, never the concrete class. Build/test 100% on MockBand. `phoenix_band.py` is P7-only.
6. **Chinese wall is structural:** two Band identities + `band/bridge.py` one-way events-only. R&D reasoning never enters a Surveillance room; the only reverse channel is the read-only rule registry.
7. **Ledger leaves bind Band message hashes:** `BandHandoff.send`/`pump` call `ledger.append(sha256(content), band_message_id)` on every message. Phase 4's gate runs `verify_chain()` over a REAL choreography run, not just unit fixtures.
8. **Don't double-parse.** Single-shot agents (Prosecution/Defense/Adjudicator) call `structured_completion` directly; tool-using agents (Investigator) run the loop then validate `AgentResult.parsed` through the schema. Don't wrap both on one call (wastes a Featherless slot).
