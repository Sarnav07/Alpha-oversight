# Alpha & Oversight — Build Progress (Phases 0–4)

Source of truth: `docs/BUILD_BLUEPRINT.md` · architecture: `docs/design.md` · run via critic-gated Workflow.
This run = mock Band + mocked LLMs (no live keys). **Phases 0–4 COMPLETE — 186/186 tests green.** Phases 5–7 deferred.

## Phase 0 — Contract-first scaffold  ✅
- [x] Repo tree + venv + deps (pyproject, requirements, editable install)
- [x] Copy reuse files into `reused/` (+ `contracts/exchange_contracts.py`) with provenance headers
- [x] Extend `ModelSpec` (api_base, key_env); strip `DecisionTraceLogger`; fix quant imports
- [x] Every net-new module as interface stub (Pydantic models fully defined, bodies `NotImplementedError`)
- [x] `config.py`, `.env.example` + `.env` skeleton, `.gitignore`, `LICENSE`(MIT), `Makefile`, `README.md`
- [x] `tests/conftest.py` — FakeGateway + MockBand + FakeLedger/FakeEventBus fixtures
- [x] **GATE:** `pytest --collect-only` green; imports resolve; `tool_registry.py` = dataclass `ToolResult`

## Phase 1 — Foundations (parallel)  ✅
- [x] 1A `rules/` + `contracts/order_events,rule_contracts` + `generators/scenarios.py` — GATE green
- [x] 1B `providers.py` + `structured.py` + gateway api_base edit — GATE green (Semaphore≤4, validate+repair)
- [x] 1C `contracts/band_envelope.py` + `band/{transport,mock_band,handoff,bridge}` — GATE green (dedup + desk)
- [x] 1D `audit/{canonical,ledger}` — GATE green (verify_chain; tamper→False)

## Phase 2 — Backtest oracle adapter  ✅
- [x] `generators/backtest_adapter.py` — GATE green (profitable→True, flat→False)

## Phase 3 — Agents + state + memory (parallel)  ✅
- [x] 3A `state/` + `contracts/case_contracts.py` — GATE green (transitions + timeout→CLOSED)
- [x] 3B `memory/` (SQLite scratchpad/journal + prompt sections) — GATE green
- [x] 3C `agents/` base + 8 wrappers + `specialist_registry` — GATE green (specialist routing + schema'd run())

## Phase 4 — Choreography on mock (milestone)  ✅
- [x] `orchestration/surveillance_pipeline.py` — `run_surveillance`: bridge→detector→investigator(+recruit @mention)→specialist→Prosecution/Defense (sequential staging, Featherless≤4)→adjudicator→engine.evaluate→escalation; transitions persisted; tee'd to replay
- [x] `orchestration/briefs.py` — extracted prompt briefs (keeps the orchestrator focused)
- [x] `orchestration/replay_writer.py` — `ReplayWriter.tee` → `events-<case>.jsonl`; `stream_replay` SSE at original cadence
- [x] `server/app.py` — `create_app` + lifespan (register_models; seed→registry; wire bus/case_store/registry/handoff/ledger/bridge/replay on app.state)
- [x] `server/routes_{cases,demo,human,stream}.py` — thin, read app.state
- [x] `state/case_store.py` — `transition` extended with optional `verdict`/`features` sidecars (additive; prior tests green)
- [x] **GATE:** `test_choreography_e2e` — Beat-A → FLAGGED + cited rule + `verify_chain()==True` over THIS run's JSONL (+ tamper→False); `test_server_app` drives the app via TestClient. **186 passed.**

## Post-build fix (lead, verified)
- [x] **Routing gap closed:** both `litellm.acompletion` sites in `reused/agent_loop.py` bypassed provider routing + the Featherless semaphore (Phase-1B TODOs left unexecuted; invisible to mocked tests). Now routed through `gateway._acompletion` (made model-kwarg tolerant) — single choke-point. 186 still green. Commit `8d97a97`.

## Punch-list for next check-in (minor; tests green, non-blocking)
- [ ] `clean_wash` scenario trips wash-trade at exactly ratio 0.5 == threshold 0.5 (boundary fragility) → make it unambiguous (e.g. same trader fills both sides, ratio→1.0)
- [ ] `SurveillanceAgent.__init__` arg order in wrappers diverges from BLUEPRINT §2 `(model_key, system_prompt, registry, bus, ledger, desk)` — align to avoid positional-call bugs in P5+
- [ ] `ReplayWriter.tee` added a `case_id` kwarg vs §2 (additive; reconcile signature)
- [ ] `test_choreography_e2e` asserts only `AnomalyDetector` was seen — assert all pipeline stages tee events
- [ ] add a dedicated marking-family FLAG scenario (only seed presence is tested today)

## Deferred (next check-ins)
- [ ] Phase 5 — `rules/codify` + regression gate + `orchestration/rnd_loop` (R&D adversary + 2 oracles) — **the on-screen wow**
- [ ] Phase 6 — frontend (Next.js viewer: topology, rule registry, verdict timeline, stats, dossiers; `?replay=`)
- [ ] Phase 7 — `band/phoenix_band` real Phoenix WS + deploy + live model-ID smoke (needs your keys)

## Review (Phase-4 milestone)
**Done & independently verified by lead:** Phases 0–4 build complete; `.venv/bin/pytest -q` → **186 passed**; clean git history (5 phase commits + 1 fix). The core claim is proven on mock Band + mocked LLMs: a surveillance case runs the full agent pipeline coordinated via Band `@mention` envelopes and flips **PASS→FLAGGED** by the deterministic rule engine, with `verify_chain()` returning True over the audit ledger produced by that exact run (and False on tamper). 95 Python files. Next: Phase 5 (codify + regression gate + R&D loop), then frontend, then real Band + deploy (needs `.env` keys + two Band identities).
