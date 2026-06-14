"""OrderAction / OrderEvent contract round-trip (Phase-1A).

These are frozen Pydantic models from Phase 0 — this test only asserts the
behaviour/serialization contract, not new fields.
"""

from __future__ import annotations

from datetime import datetime, timezone

from alpha_oversight.contracts.exchange_contracts import (
    ExchangeOrder,
    OrderType,
    Side,
)
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent


def _order(**kw) -> ExchangeOrder:
    base = dict(
        symbol="ACME",
        side=Side.BUY,
        quantity=100,
        order_type=OrderType.LIMIT,
        limit_price=10.0,
    )
    base.update(kw)
    return ExchangeOrder(**base)


def test_order_action_values() -> None:
    assert OrderAction.PLACE == "PLACE"
    assert OrderAction.MODIFY == "MODIFY"
    assert OrderAction.CANCEL == "CANCEL"
    assert OrderAction.FILL == "FILL"
    assert {a.value for a in OrderAction} == {"PLACE", "MODIFY", "CANCEL", "FILL"}


def test_order_event_defaults_trader_id() -> None:
    ev = OrderEvent(
        action=OrderAction.PLACE,
        order=_order(),
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    assert ev.trader_id == ""
    assert ev.action is OrderAction.PLACE
    assert ev.order.symbol == "ACME"


def test_order_event_json_roundtrip() -> None:
    ts = datetime(2026, 6, 14, 12, 0, 0, tzinfo=timezone.utc)
    ev = OrderEvent(
        action=OrderAction.CANCEL,
        order=_order(order_id="o-1", side=Side.SELL, quantity=250),
        timestamp=ts,
        trader_id="trader-x",
    )
    blob = ev.model_dump_json()
    back = OrderEvent.model_validate_json(blob)

    assert back.action is OrderAction.CANCEL
    assert back.trader_id == "trader-x"
    assert back.order.order_id == "o-1"
    assert back.order.side is Side.SELL
    assert back.order.quantity == 250
    assert back.timestamp == ts


def test_order_event_dict_roundtrip_preserves_enum() -> None:
    ev = OrderEvent(
        action=OrderAction.FILL,
        order=_order(),
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    d = ev.model_dump()
    assert d["action"] == "PLACE" or d["action"] == OrderAction.FILL
    # rebuild from the dumped dict
    back = OrderEvent.model_validate(d)
    assert back.action is OrderAction.FILL
