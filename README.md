# Alpha & Oversight

Adversarial trade-surveillance coordinated through **Band** — built for the
lablab.ai *Band of Agents* hackathon (Track 3, regulated/high-stakes).

Two desks coordinate through Band: an R&D adversary proposes order-event
sequences engineered to evade detection *and* be economically real; a
Surveillance desk (AnomalyDetector → Investigator → runtime-recruited
Specialist → Prosecution⚔Defense debate that sets contested inputs → a
**deterministic rule engine** that renders the authoritative verdict →
EscalationManager → human) catches them. On human-confirm a new rule is
codified live and a regression gate asserts the evasion now trips. Every step
is recorded in a hash-chained audit ledger whose leaves are Band message hashes.

See `docs/design.md` (locked architecture) and `docs/BUILD_BLUEPRINT.md` (build
spec + exact interface signatures).

## Quickstart

```bash
# The repo venv already exists at .venv with deps installed.
make install          # editable install of the alpha_oversight package (no network)
cp .env.example .env  # fill keys later; USE_REAL_BAND=false runs everything on MockBand

make collect          # pytest --collect-only — import-clean gate
make test             # full suite (LLMs mocked, Band = MockBand; never hits the network)
make run-backend      # FastAPI app (Phase 4+)
```

Python 3.12. All LLM calls are mocked in tests; the Band transport in tests is
an in-process `MockBand`. Nothing in the test path touches a live API.

## Layout

```
backend/alpha_oversight/
  reused/      lifted arena code (agent loop, gateway, events, compaction, trace models, eval gate, quant oracle)
  contracts/   exchange_contracts (wire orders) · order_events · band_envelope · rule_contracts · case_contracts
  rules/       deterministic engine + per-family math + SQLite registry + seed rules
  generators/  labeled scenarios + backtest adapter (R&D oracle bridge)
  band/        BandTransport Protocol · MockBand (default) · BandHandoff · SanitizedBridge · PhoenixBand [P7]
  memory/      SQLite scratchpad/journal + prompt-section assembly
  audit/       canonical JSON + hash-chained ledger (verify_chain)
  state/       case state machine + aiosqlite CaseStore
  agents/      SurveillanceAgent base + 8 role wrappers + specialist registry
  orchestration/ surveillance pipeline · replay writer · R&D loop [P5]
  server/      FastAPI app + SSE/case/human/demo routes
  config.py    env-driven settings (§3)
backend/tests/ conftest (FakeGateway + MockBand fixtures) + per-module tests
scripts/       day-0 smokes · chain verify · replay record
```

## License

MIT — see `LICENSE`.
