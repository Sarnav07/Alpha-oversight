# Alpha & Oversight — Build Progress

Source of truth: `docs/BUILD_BLUEPRINT.md` · architecture: `docs/design.md` · built via critic-gated Workflows.
**Backend COMPLETE — Phases 0–5 + Phase 7 done, 197/197 tests green, Beat-B proven on mock AND real Band.** The whole choreography runs over real Band on the user-chosen live model mix. **Only Phase 6 (frontend trace viewer) remains** (deploy folds into it).

## Phase 0 — Contract-first scaffold  ✅
- [x] Tree + venv + deps + editable install · reuse copies (provenance) · every net-new module stubbed (models frozen) · config/.env/conftest(FakeGateway+MockBand+FakeLedger+FakeEventBus) · GATE: collect-only + imports green

## Phase 1 — Foundations  ✅
- [x] 1A rules engine (spoof/layer/wash/marking) + order_events + scenarios · 1B providers(api_base+Semaphore-4)+structured · 1C band_envelope+MockBand+handoff+bridge · 1D hash-chain ledger(verify_chain; tamper→False)

## Phase 2 — Backtest oracle adapter  ✅
- [x] `generators/backtest_adapter.py` (OrderEvent→quant Order→PnL/impact; profitable→True, flat→False)

## Phase 3 — Agents + state + memory  ✅
- [x] 3A state machine + case_store · 3B 3-layer memory (compaction + SQLite scratchpad/journal) · 3C base + 8 agent wrappers + specialist registry

## Phase 4 — Choreography on mock (milestone)  ✅
- [x] `surveillance_pipeline` (bridge→detector→investigator+recruit→specialist→Prosecution/Defense staged≤4→adjudicator→engine→escalation) + replay_writer + FastAPI app + routes
- [x] **GATE:** `test_choreography_e2e` — Beat-A → FLAGGED + cited rule + `verify_chain()==True` over the run's JSONL (+ tamper→False); TestClient app test

## Phase 5 — Co-evolution (Beat-B)  ✅
- [x] 5A `rules/codify` — `derive_rule` (parameterized: family inference + debate-resolved window+slack/floors) + `regression_gate` (replays evasion through new registry, True only on FLAG)
- [x] 5B `orchestration/rnd_loop` — adversary gated by BOTH oracles (engine PASS=evaded AND backtest profitable), bounded K rounds, hands only events across the wall
- [x] 5C integration — suspicious-but-passing → ESCALATED; `POST /cases/{id}/confirm` → derive→codify→regression→FLAGGED; rule_codified ledger leaf
- [x] **GATE:** `test_beat_b_e2e` — novel 400ms evasion ESCALATES → confirm → **Active Rules 4→5** → PASS→FLAGGED → `verify_chain()==True`. **197 passed.**

## Post-build fixes (lead, verified)
- [x] Routed both `agent_loop.py` LLM sites through `gateway._acompletion` (provider api_base/key + Featherless semaphore) — closed the live-run 404/429 gap (commit `8d97a97`)

## Punch-list for demo polish / pre-P7 (minor; tests green, non-blocking)
- [ ] Wire `run_rnd` to a `/demo/rnd` endpoint so the live R&D desk produces evasions end-to-end (Beat-B currently injects a canned evasion via `/demo/beat-b`)
- [ ] `design.md §10` narration says rules `3→4`; real counter is **`4→5`** (4 seed families) — refresh the pitch prose
- [ ] Keep the Beat-B invariant asserted: escalation depends on the adjudicator resolving a narrow window (a wide resolved window would override every seed rule and FLAG instantly)
- [ ] Add a "no-live-network" guard test (today: source-grep + monkeypatch + MockBand, not enforced in CI)
- [ ] `clean_wash` sits exactly on the 0.5 threshold; `SurveillanceAgent` arg-order + `ReplayWriter.tee` signature drift vs blueprint §2; add a marking-family FLAG scenario

## Phase 6 — Frontend (trace viewer)  ⬜  ← NEXT
- [ ] Next.js viewer: topology graph (blue=waiting-on-Band) · live rule registry (4→5 flash) · PASS→FLAGGED timeline · Prosecution/Defense model badges · persistent stats bar · `?replay=` JSONL
- [ ] Wire to backend contracts: `/stream` SSE (desk) · `/cases` · `/cases/{id}/audit` · `/rules` · `/stats`

## Phase 7 — Real Band + live models  ✅ DONE (validated 2026-06-16 — see `docs/LIVE_RUN.md`)
- [x] `band/phoenix_band.py` implemented — **REST-poll mode** (`/messages/next` + `/processing`+`/processed` + `POST .../messages`); robust, no Phoenix-WS heartbeat. Implements `BandTransport` unchanged. Now: unresolved internal roles fall back to `default_mention` (the human) — Band requires a non-self mention with ≥1 entry.
- [x] Two real Band identities registered + added to ONE shared room (`BAND_SHARED_ROOM`); human peer resolved.
- [x] **Live providers** verified on `/v1` + Featherless. **Model mix (user-chosen):** Prosecution `claude-sonnet-4-6`, Escalation `gpt-5-mini`, plumbing (anomaly/investigator/specialist/adjudicator) `Qwen/Qwen3-Next-80B-A3B-Instruct`, Defense `Qwen/Qwen3.6-35B-A3B`. `gpt-5-mini` temperature-rejection guarded via `litellm.drop_params` + reasoning headroom. ~130s/full case (the two reasoning models dominate). `scripts/probe_models.py` re-verifies ids+latency.
- [x] **Live Band round-trip** (`scripts/live_band_smoke.py`): R&D→Surv over real Band; ledger leaf binds real `band_message_id`; `verify_chain()=True`. PASS.
- [x] **Live Beat-A** (`scripts/live_e2e.py`, MockBand transport + real LLMs): 8-agent choreography → FLAGGED (`FINRA-5210-layering`) + verify_chain. PASS.
- [x] **WHOLE choreography over REAL Band** (`scripts/live_realband_e2e.py`): both desks are real `PhoenixBand` on the shared room; the R&D→Surv handoff, **every internal desk step, and the human escalation are real Band messages** (6 handoff leaves bind real `band_message_id`s); Beat-A → FLAGGED + `verify_chain()=True`. PASS.
- [x] **Server `USE_REAL_BAND` path** (`server/app.py`): builds two `PhoenixBand` identities on the shared room; `case_id` decoupled from the Band room (many cases share one room). Verified via `scripts/verify_phase7_server.py`.
- [x] **`/demo/rnd` live R&D endpoint** (`routes_demo.py`): runs the live adversary (two-oracle gated); first confirmed evasion crosses the wall → full choreography. Non-deterministic (canned `/demo/beat-b` is the always-escalates version).
- [x] **Live Beat-B** (`scripts/live_beat_b.py` MockBand; `scripts/live_realband_beat_b.py` REAL Band): novel evasion ESCALATES → confirm → codify → **Active Rules 4→5** → FLAG, chain verified.
- [x] Live-run design fixes (real-model bugs the mocks hid): deterministic features in `flow_brief`/`rules/features.py`; `parse_mention` from first `{`; string `ToolResult.data`; conservative Adjudicator window. **197 mock tests still green** after the model swap + real-Band wiring.
- [ ] Deploy (Vercel viewer + replay backend) — frontend-coupled; folds into Phase 6.

## Review
**Phases 0–5 done & independently verified by lead.** `pytest -q` → **197 passed**; 7+ commits clean history. The full claim is proven on mock Band + mocked LLMs: a surveillance case coordinated via Band `@mention` envelopes flips PASS→FLAGGED by the deterministic engine with a `verify_chain`-able audit ledger; and the co-evolution loop closes — a novel evasion that slips the seed rules ESCALATES, a human confirm codifies a derived rule, the regression gate replays it to FLAG, and Active Rules go 4→5. Chinese wall enforced (bridge strips reasoning/model_key). Next: the read-only viewer (Presentation), then real Band + deploy.
