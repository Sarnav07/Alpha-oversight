# Task 5B-rnd-loop — R&D co-evolution loop (orchestration/rnd_loop.py)

## Plan
- [ ] Write `backend/tests/test_rnd_loop.py` (TDD: fail first).
- [ ] Implement `async run_rnd(registry_snapshot, handoff, resolved_inputs, K=3, seed=0, ...)`.
- [ ] Up to K rounds: Adversary (mocked via injected agent) proposes `list[OrderEvent]`.
- [ ] Oracle-1 = `rules.engine.evaluate(events, resolved_inputs, registry)` MISS == PASS.
- [ ] Oracle-2 = `generators.backtest_adapter.is_profitable_and_moved(events, seed)`.
- [ ] EVADE + PROFIT => confirmed novel evasion: cross the wall via SanitizedBridge
      (`publish_flow` -> kind=HANDOFF, payload events only). Return it.
- [ ] Otherwise next round; stop at K (bounded — no wedge).

## Test cases
1. Oracle-1 misses + Oracle-2 profitable (mock adversary -> novel_layering_evasion())
   => confirmed evasion returned + a HANDOFF envelope emitted carrying ONLY events.
2. Flat/benign sequence => not confirmed (returns unconfirmed after K).
3. K-round cap terminates the loop (adversary called at most K times; bounded).

## Review — DONE
- Implemented `run_rnd(registry_snapshot, handoff, resolved_inputs=None, K=3, seed=0,
  *, surveillance_room="case-rnd", adversary)` + `RnDResult` dataclass. 129 LOC.
- Oracle-1 = `engine.evaluate(events, resolved, rules).result == "PASS"` (MISS).
- Oracle-2 = `is_profitable_and_moved(events, seed=seed)` (unchanged module).
- Confirmed evasion crosses via `SanitizedBridge.publish_flow(events)` -> HANDOFF,
  payload {"events": [...]} only (R&D reasoning + model_key stripped by the bridge).
- Bounded: `for round_idx in range(1, K+1)`; stops at K. `adversary` keyword-only +
  injected (Protocol `_AdversaryLike`) so tests mock it with zero LLM/network.
- `registry_snapshot` accepts a `list[Rule]` OR a store (`.active()`), read read-only.
- KEY FINDING: bare `novel_layering_evasion()` EVADES the seed rules (Oracle-1 PASS)
  but is NOT profitable to the real backtest (only resting BUYs, no closing leg/impact),
  so Oracle-2 was False. A *confirmed novel evasion* must be both deceptive-shaped AND
  value-extracting, so the test's adversary returns the ~400ms ladder PLUS a large
  buy-low(day0)/sell-high(day1) round-trip. Verified combined => Oracle-1 PASS +
  Oracle-2 True. Oracle-2 was NOT weakened.
- Tests: 3/3 pass (confirmed+HANDOFF-events-only / flat-not-confirmed / K-cap). Full
  suite 194 passed, 0 regressions.
