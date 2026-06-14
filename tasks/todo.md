# Alpha & Oversight — Build Progress (Phases 0–4)

Source of truth: `docs/BUILD_BLUEPRINT.md` · architecture: `docs/design.md` · run via critic-gated Workflow.
This run = mock Band + mocked LLMs (no live keys). Phases 5–7 deferred.

## Phase 0 — Contract-first scaffold  ⏳
- [ ] Repo tree + venv + deps (pyproject, requirements)
- [ ] Copy reuse files into `reused/` (+ `contracts/exchange_contracts.py`) with provenance headers
- [ ] Extend `ModelSpec` (api_base, key_env); strip `DecisionTraceLogger`; fix quant imports
- [ ] Every net-new module as interface stub (Pydantic models fully defined, bodies `NotImplementedError`)
- [ ] `config.py`, `.env.example` + `.env` skeleton, `.gitignore`, `LICENSE`(MIT), `Makefile`, `README.md`
- [ ] `tests/conftest.py` — FakeGateway + MockBand fixtures
- [ ] **GATE:** `.venv/bin/pytest --collect-only -q` green; imports resolve; `tool_registry.py` = dataclass `ToolResult`

## Phase 1 — Foundations (parallel)  ⬜
- [ ] 1A `rules/` + `contracts/order_events,rule_contracts` + `generators/scenarios.py` — GATE: test_rule_engine, test_order_events
- [ ] 1B `providers.py` + `structured.py` + gateway api_base edit — GATE: test_providers (Semaphore≤4), test_structured (validate+repair)
- [ ] 1C `contracts/band_envelope.py` + `band/{transport,mock_band,handoff,bridge}` — GATE: test_mock_band, test_handoff (dedup + desk)
- [ ] 1D `audit/{canonical,ledger}` — GATE: test_ledger + verify_chain (tamper→False)

## Phase 2 — Backtest oracle adapter  ⬜
- [ ] `generators/backtest_adapter.py` — GATE: test_backtest_adapter (profitable→True, flat→False)

## Phase 3 — Agents + state + memory (parallel)  ⬜
- [ ] 3A `state/` + `contracts/case_contracts.py` — GATE: test_state_machine (transitions + timeout→CLOSED)
- [ ] 3B `memory/` (SQLite scratchpad/journal + prompt sections)
- [ ] 3C `agents/` base + 8 wrappers + `specialist_registry` — GATE: test_specialist_select + schema'd run() vs FakeGateway

## Phase 4 — Choreography on mock (milestone)  ⬜
- [ ] `orchestration/{surveillance_pipeline,replay_writer}` + `server/app` + routes
- [ ] **GATE:** test_choreography_e2e — Beat-A → FLAGGED case + `verify_chain()==True` over the run's ledger

## Deferred (next check-ins)
- [ ] Phase 5 — `rules/codify` + regression gate + `orchestration/rnd_loop` (R&D adversary + 2 oracles)
- [ ] Phase 6 — frontend (Next.js viewer: topology, rule registry, verdict timeline, stats, dossiers; `?replay=`)
- [ ] Phase 7 — `band/phoenix_band` real Phoenix WS + deploy + live model-ID smoke (needs your keys)

## Review (filled at milestone)
_pending Phase-4 gate_
