# Alpha & Oversight — Backend (CLAUDE.md)

Adversarial trade-surveillance coordinated through **Band**. lablab.ai *Band of
Agents* hackathon, Track 3 (regulated/high-stakes). This file is the backend
repo guide; the global `~/CLAUDE.md` workflow rules still apply on top.

## Status (source of truth: `tasks/todo.md`)
**Backend COMPLETE — Phases 0–5 done, 197/197 tests green** on **mock Band +
mocked LLMs (no live keys needed)**. The core claim is proven end-to-end:
- A surveillance case coordinated via Band `@mention` envelopes flips
  **PASS→FLAGGED** by the deterministic engine, with a `verify_chain()`-able
  hash-chained audit ledger (tamper → `False`).
- **Co-evolution (Beat-B)** closes: a novel evasion that slips the 4 seed rules
  **ESCALATES** → human confirm → `derive_rule` codifies → regression gate
  replays it to **FLAG** → **Active Rules 4→5**.

**Phase 7 DONE (2026-06-16):** the whole choreography runs over **REAL Band** —
two `PhoenixBand` identities on the shared room; the R&D→Surv handoff, every
internal desk step, and the human escalation are real Band messages (each leaf
binds a real `band_message_id`, `verify_chain()` holds). Live model mix:
`claude-sonnet-4-6` Prosecution · `gpt-5-mini` Escalation ·
`Qwen3-Next-80B-A3B-Instruct` plumbing · `Qwen3.6-35B-A3B` Defense. Server
`USE_REAL_BAND=true` + `/demo/rnd` shipped. See `docs/LIVE_RUN.md`.

**Remaining:** Phase 6 (frontend trace viewer — being built in the sibling
`alpha-oversight-frontend/frontend` repo); deploy folds into it.

## Authoritative docs (read before touching architecture)
- `docs/design.md` — **locked** architecture. Do not contradict it.
- `docs/BUILD_BLUEPRINT.md` — build spec + exact interface signatures.
- `tasks/todo.md` — phase-by-phase progress + the live punch-list.
- `tasks/todo-rnd-loop.md` — R&D-loop detail.
- `docs/MODEL_ASSIGNMENTS.md` — per-seat model choices (frontier adversary + 4
  distinct families at the key decisions), Featherless cold-load/rate-limit facts,
  and `scripts/warm_models.py`. Reflects the 2026-06-17 model reassignment.

## Commands (venv already exists at `.venv`, deps installed — no network needed)
```bash
make install      # editable install of alpha_oversight (--no-deps, offline)
make collect      # pytest --collect-only — import-clean gate
make test         # full suite (LLMs mocked, Band = MockBand; never hits network)
make run-backend  # uvicorn alpha_oversight.server.app:create_app --factory :8000
```
Always run pytest via `.venv/bin/pytest` (or `make test`), not a bare `pytest`.
Python 3.12.

## Architecture map (`backend/alpha_oversight/`)
- `reused/` — lifted arena code, each file carries a `# LIFTED FROM …:line`
  provenance header. **Do not rewrite these from scratch**; extend in place.
  (agent_loop, gateway, cost_tracker, events, compaction, trace_models,
  eval_gate, quant/ oracle.)
- `contracts/` — Pydantic wire/domain models: exchange_contracts (wire orders)
  · order_events (PLACE/MODIFY/CANCEL + OrderEvent) · band_envelope ·
  rule_contracts · case_contracts. **Interfaces are frozen** — agents were built
  in parallel against these; change with care.
- `rules/` — the **deterministic** rule engine (renders the authoritative
  verdict; LLMs never decide PASS/FLAG) + per-family math
  (spoofing/layering/wash_trade/marking) + SQLite registry + seed_rules +
  `codify.derive_rule`/`regression_gate`.
- `generators/` — labeled scenarios + `backtest_adapter` (OrderEvent → quant
  `Order` → PnL/impact; the R&D oracle bridge).
- `band/` — `transport.py` (BandTransport Protocol) · `mock_band.py` (DEFAULT,
  in-process) · `handoff.py` (@mention round-trip, msg_id dedupe, carries
  `desk`) · `bridge.py` (SanitizedBridge — **Chinese wall**: strips
  reasoning/model_key across desks) · `phoenix_band.py` (real Band, REST-poll;
  internal roles fall back to `default_mention`=human — Band needs a non-self
  mention ≥1).
- `memory/` — 3 layers: L1 turn-aware in-context compaction (`reused/compaction`)
  · L2 SQLite scratchpad/journal · L3 = the audit ledger.
- `audit/` — `canonical.py` (canonical JSON) + `ledger.py` (hash-chained,
  `verify_chain()`). Ledger leaves bind Band message hashes.
- `state/` — case state machine + aiosqlite CaseStore.
- `agents/` — `base_agent.SurveillanceAgent` + 8 role wrappers
  (anomaly_detector, investigator, specialist, prosecution, defense,
  adjudicator, escalation_manager, adversary) + `specialist_registry`
  (runtime feature-vector → specialist selection).
- `orchestration/` — `surveillance_pipeline` (the Beat-A choreography) ·
  `rnd_loop` (Beat-B adversary, gated by BOTH oracles) · `replay_writer` ·
  `briefs`.
- `server/` — FastAPI `app.create_app` (factory) + routes_{stream(SSE),cases,
  human,demo}. `/demo/beat-b` injects a canned evasion; `/demo/rnd` runs the
  LIVE adversary (two-oracle gated); `/cases/{id}/confirm` triggers
  derive→codify→regression→FLAGGED. `USE_REAL_BAND=true` builds two real
  `PhoenixBand` identities on the shared room.

## Critical invariants — do NOT break these
- **The rule engine is the only authority for PASS/FLAG.** Agents debate and set
  contested inputs; they never render the verdict. Keep it deterministic.
- **Chinese wall:** the R&D and Surveillance desks only exchange data through
  `band/bridge.py`, which strips reasoning/model_key. Never hand raw agent
  reasoning across the wall.
- **Audit ledger leaves bind Band message hashes** — a verdict's provenance must
  remain `verify_chain()`-able. Don't write to the ledger out of band.
- **Beat-B escalation hinges on the adjudicator resolving a *narrow* window** —
  a wide resolved window would override every seed rule and FLAG instantly,
  destroying the demo. Preserve this when editing the debate/adjudicator path.
- **Provider routing:** all 4 `litellm.acompletion` sites route through
  `gateway._acompletion` (api_base/key_env via extended `ModelSpec` + a
  process-wide `asyncio.Semaphore(4)` for Featherless). A missed site = a live
  404/429. Don't add a bypassing acompletion call.
- **No live network in the test path.** Tests use `FakeGateway` + `MockBand`
  (`conftest.py`). Keep it that way — never add a test that hits a real API.

## Conventions
- TDD: every module ships `backend/tests/test_*.py`; a phase isn't done until its
  gate pytest passes. Add/extend the matching test with any change.
- `USE_REAL_BAND=false` is the default; `.env.example` documents the keys to
  paste before a Phase-7 live run. Never commit `.env`.
- Two order types coexist (`ExchangeOrder` wire ↔ quant `Order` backtest); the
  **only** conversion seam is `generators/backtest_adapter.py`.

## Known punch-list (non-blocking, tests green) — see `tasks/todo.md`
- Pitch prose in `design.md §10` says rules `3→4`; real counter is **`4→5`**.
- Add an enforced "no-live-network" guard test in CI.
- `clean_wash` sits exactly on the 0.5 threshold; `SurveillanceAgent` arg-order +
  `ReplayWriter.tee` signature drift vs blueprint §2.
