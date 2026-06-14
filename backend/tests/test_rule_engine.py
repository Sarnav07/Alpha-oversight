"""Deterministic rule engine + scenario generators + seed registry (Phase-1A).

Only the rules/* + generators/scenarios + the registry store are under test
here. No LLMs, no Band — pure deterministic math. The SQLite registry uses the
tmp ``rules_db`` fixture.

Spec contract under test (BUILD_BLUEPRINT §2 + design §6.2):
  - clean_layering / clean_spoofing / clean_wash → FLAG against the seed rules,
    with a cited_metric and the firing rule_id.
  - a benign sequence → PASS.
  - novel_layering_evasion (≈400ms window) → PASS against the *seed* rules
    (the 400ms timing slips the 100ms seed window).
"""

from __future__ import annotations

from alpha_oversight.contracts.case_contracts import ResolvedInputs
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent
from alpha_oversight.generators import scenarios
from alpha_oversight.rules import seed_rules
from alpha_oversight.rules.engine import evaluate
from alpha_oversight.rules.registry import RuleRegistryStore


# ── seed_rules + registry store ──────────────────────────────────────────────


def test_seed_rules_are_active_and_curated() -> None:
    rules = seed_rules.seed_rules()
    assert len(rules) >= 3
    assert all(r.status == "ACTIVE" for r in rules)
    families = {r.family.value for r in rules}
    assert {"layering", "spoofing", "wash_trade"} <= families
    # provenance cites the real regs
    provs = " ".join(r.provenance for r in rules)
    assert "FINRA-5210" in provs
    assert "10b-5" in provs


def test_registry_store_seed_and_roundtrip(rules_db: str) -> None:
    store = RuleRegistryStore(rules_db)
    assert store.count() == 0
    for r in seed_rules.seed_rules():
        store.codify(r)
    seeded = seed_rules.seed_rules()
    assert store.count() == len(seeded)
    active = store.active()
    assert {r.id for r in active} == {r.id for r in seeded}
    # params survive the sqlite round-trip
    by_id = {r.id: r for r in active}
    src = {r.id: r for r in seeded}
    for rid, r in by_id.items():
        assert r.params == src[rid].params
        assert r.family == src[rid].family
        assert r.status == "ACTIVE"


def test_registry_persists_across_instances(rules_db: str) -> None:
    store = RuleRegistryStore(rules_db)
    for r in seed_rules.seed_rules():
        store.codify(r)
    n = store.count()
    # a fresh handle on the same db sees the same rows
    store2 = RuleRegistryStore(rules_db)
    assert store2.count() == n


# ── scenarios → engine verdicts ──────────────────────────────────────────────


def _empty_inputs() -> ResolvedInputs:
    return ResolvedInputs()


def _seeded_store(rules_db: str) -> RuleRegistryStore:
    store = RuleRegistryStore(rules_db)
    for r in seed_rules.seed_rules():
        store.codify(r)
    return store


def test_clean_layering_flags(rules_db: str) -> None:
    store = _seeded_store(rules_db)
    events = scenarios.clean_layering()
    v = evaluate(events, _empty_inputs(), store.active())
    assert v.result == "FLAG"
    assert v.rule_id is not None
    assert "layering" in v.rule_id.lower()
    assert v.cited_metric is not None
    # the cited metric names the measured quantity
    assert "depth_levels" in v.cited_metric


def test_clean_spoofing_flags(rules_db: str) -> None:
    store = _seeded_store(rules_db)
    events = scenarios.clean_spoofing()
    v = evaluate(events, _empty_inputs(), store.active())
    assert v.result == "FLAG"
    assert v.rule_id is not None
    assert "spoof" in v.rule_id.lower()
    assert v.cited_metric is not None
    assert "cancel_ratio" in v.cited_metric


def test_clean_wash_flags(rules_db: str) -> None:
    store = _seeded_store(rules_db)
    events = scenarios.clean_wash()
    v = evaluate(events, _empty_inputs(), store.active())
    assert v.result == "FLAG"
    assert v.rule_id is not None
    assert "wash" in v.rule_id.lower()
    assert v.cited_metric is not None
    assert "self_match_ratio" in v.cited_metric


def test_benign_sequence_passes(rules_db: str) -> None:
    """A normal place→fill with no cancels, single side, no self-match → PASS."""
    from datetime import datetime, timezone

    from alpha_oversight.contracts.exchange_contracts import (
        ExchangeOrder,
        OrderStatus,
        OrderType,
        Side,
    )

    t0 = datetime(2026, 6, 14, 12, 0, 0, tzinfo=timezone.utc)
    o = ExchangeOrder(
        order_id="b-1",
        symbol="ACME",
        side=Side.BUY,
        quantity=100,
        order_type=OrderType.LIMIT,
        limit_price=10.0,
        status=OrderStatus.FILLED,
    )
    events = [
        OrderEvent(action=OrderAction.PLACE, order=o, timestamp=t0, trader_id="alice"),
        OrderEvent(action=OrderAction.FILL, order=o, timestamp=t0, trader_id="alice"),
    ]
    store = _seeded_store(rules_db)
    v = evaluate(events, _empty_inputs(), store.active())
    assert v.result == "PASS"
    assert v.rule_id is None


def test_novel_400ms_evasion_passes_seed_rules(rules_db: str) -> None:
    """Beat-B: the 400ms layering variant slips the 100ms seed window → PASS."""
    store = _seeded_store(rules_db)
    events = scenarios.novel_layering_evasion()
    v = evaluate(events, _empty_inputs(), store.active())
    assert v.result == "PASS", (
        "novel 400ms evasion must PASS the seed (100ms) rules; "
        f"got {v.result} via {v.rule_id}"
    )


def test_novel_evasion_is_economically_layering_shaped() -> None:
    """Sanity: the evasion is still a multi-level layering pattern (so a
    widened-window rule would catch it later in Phase 5)."""
    events = scenarios.novel_layering_evasion()
    placed = [e for e in events if e.action is OrderAction.PLACE]
    cancelled = [e for e in events if e.action is OrderAction.CANCEL]
    # multiple resting levels that get pulled — the layering shape
    assert len(placed) >= 3
    assert len(cancelled) >= 3


def test_resolved_inputs_window_override_flags_novel(rules_db: str) -> None:
    """The debate can SET the contested window: a 500ms resolved window makes
    the same novel evasion FLAG under the layering rule (debate is load-bearing)."""
    store = _seeded_store(rules_db)
    events = scenarios.novel_layering_evasion()
    resolved = ResolvedInputs(window_ms=500, intent="manipulative")
    v = evaluate(events, resolved, store.active())
    assert v.result == "FLAG"
    assert v.rule_id is not None and "layering" in v.rule_id.lower()


def test_engine_is_deterministic(rules_db: str) -> None:
    store = _seeded_store(rules_db)
    active = store.active()
    events = scenarios.clean_spoofing()
    v1 = evaluate(events, _empty_inputs(), active)
    v2 = evaluate(events, _empty_inputs(), active)
    assert v1.model_dump() == v2.model_dump()
