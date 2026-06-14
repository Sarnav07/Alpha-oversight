"""Labeled order-event scenario generators (Phase-1A).

Beat-A clean patterns FLAG against the seed rules; the Beat-B novel evasion
PASSes them (a timing variant). These double as the rule engine's label source.

All sequences are deterministic (fixed base timestamp + fixed millisecond
offsets), so the engine's verdict is reproducible. Each generator targets
exactly one seed family and is built NOT to trip the others:
  - layering   : multi-level resting buys, pulled together; no opposite fills
                 (so spoofing stays silent), one symbol/no self-match.
  - spoofing   : one big resting buy at ONE level (so layering stays silent),
                 cancelled right after an opposite SELL fill.
  - wash       : same trader both sides at one price (self-match), no cancels.
  - evasion    : the layering shape, but cancels spread across ~400ms so the
                 100ms seed layering window is slipped → PASS.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from alpha_oversight.contracts.exchange_contracts import (
    ExchangeOrder,
    OrderStatus,
    OrderType,
    Side,
)
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent

_T0 = datetime(2026, 6, 14, 14, 0, 0, tzinfo=timezone.utc)
_SYMBOL = "ACME"
_BEST_BID = 10.00


def _at(ms: float) -> datetime:
    return _T0 + timedelta(milliseconds=ms)


def _order(
    order_id: str,
    side: Side,
    quantity: int,
    price: float,
    *,
    status: OrderStatus = OrderStatus.OPEN,
) -> ExchangeOrder:
    return ExchangeOrder(
        order_id=order_id,
        symbol=_SYMBOL,
        side=side,
        quantity=quantity,
        order_type=OrderType.LIMIT,
        limit_price=price,
        status=status,
    )


def _filled(order_id: str, side: Side, quantity: int, price: float) -> ExchangeOrder:
    o = _order(order_id, side, quantity, price, status=OrderStatus.FILLED)
    o.avg_fill_price = price
    o.filled_quantity = quantity
    return o


# ── Beat-A: clean patterns that FLAG the seed registry ───────────────────────


def clean_layering() -> list[OrderEvent]:
    """Beat-A known layering pattern (FLAGs).

    Four resting buy orders at four distinct sub-best-bid levels, all pulled
    within ~60ms (inside the 100ms seed window). 4 levels >= 3 threshold → FLAG.
    """
    prices = [9.99, 9.98, 9.97, 9.96]
    events: list[OrderEvent] = []
    # Place the ladder.
    for i, px in enumerate(prices):
        o = _order(f"lay-{i}", Side.BUY, 500, px)
        events.append(
            OrderEvent(action=OrderAction.PLACE, order=o, timestamp=_at(i * 5), trader_id="spoofy")
        )
    # Pull the whole ladder in a tight cluster (span ~30ms <= 100ms).
    for i, px in enumerate(prices):
        o = _order(f"lay-{i}", Side.BUY, 500, px, status=OrderStatus.CANCELLED)
        events.append(
            OrderEvent(
                action=OrderAction.CANCEL,
                order=o,
                timestamp=_at(40 + i * 10),
                trader_id="spoofy",
            )
        )
    return events


def clean_spoofing() -> list[OrderEvent]:
    """Beat-A known spoofing pattern (FLAGs).

    A large bona-fide-looking BUY at one level pushes the book; a genuine SELL
    fills; the BUY is cancelled 20ms after that fill. cancel_ratio = 1.0 >= 0.8
    and the cancel is within the 100ms window of the opposite fill → FLAG.
    Single price level keeps layering silent.
    """
    events: list[OrderEvent] = []
    big = _order("spf-buy", Side.BUY, 5000, _BEST_BID)
    events.append(
        OrderEvent(action=OrderAction.PLACE, order=big, timestamp=_at(0), trader_id="spoofy")
    )
    # The genuine opposite-side fill the spoof was set up to obtain.
    sell = _filled("spf-sell", Side.SELL, 300, _BEST_BID + 0.02)
    events.append(
        OrderEvent(action=OrderAction.FILL, order=sell, timestamp=_at(50), trader_id="spoofy")
    )
    # Cancel the big buy 20ms after the opposite fill (within 100ms window).
    cancelled = _order("spf-buy", Side.BUY, 5000, _BEST_BID, status=OrderStatus.CANCELLED)
    events.append(
        OrderEvent(action=OrderAction.CANCEL, order=cancelled, timestamp=_at(70), trader_id="spoofy")
    )
    return events


def clean_wash() -> list[OrderEvent]:
    """Beat-A known wash-trade pattern (FLAGs).

    One trader fills both sides of the same instrument at the same price:
    self_match_ratio = 1.0 >= 0.5 → FLAG. No cancels / single level keeps the
    spoofing & layering metrics silent.
    """
    px = _BEST_BID
    buy = _filled("wash-buy", Side.BUY, 1000, px)
    sell = _filled("wash-sell", Side.SELL, 1000, px)
    return [
        OrderEvent(action=OrderAction.FILL, order=buy, timestamp=_at(0), trader_id="launderer"),
        OrderEvent(action=OrderAction.FILL, order=sell, timestamp=_at(10), trader_id="launderer"),
    ]


# ── Beat-B: novel evasion that PASSes the seed registry ──────────────────────


def novel_layering_evasion() -> list[OrderEvent]:
    """Beat-B: a ~400ms variant that PASSes the seed rules.

    Same economic layering shape as ``clean_layering`` (four sub-best-bid levels
    pulled), but the cancels are spread across ~400ms. The cancelled-cluster span
    (~400ms) exceeds the seed layering rule's 100ms window, so the layering
    metric does NOT trip → PASS against the seed set. A human-confirmed
    ``layering-v2`` rule with window_ms=500 (Phase 5) re-catches it.
    """
    prices = [9.99, 9.98, 9.97, 9.96]
    events: list[OrderEvent] = []
    for i, px in enumerate(prices):
        o = _order(f"ev-{i}", Side.BUY, 500, px)
        events.append(
            OrderEvent(action=OrderAction.PLACE, order=o, timestamp=_at(i * 5), trader_id="spoofy2")
        )
    # Drip the cancels ~130ms apart → span ≈ 390ms, > 100ms seed window.
    for i, px in enumerate(prices):
        o = _order(f"ev-{i}", Side.BUY, 500, px, status=OrderStatus.CANCELLED)
        events.append(
            OrderEvent(
                action=OrderAction.CANCEL,
                order=o,
                timestamp=_at(50 + i * 130),
                trader_id="spoofy2",
            )
        )
    return events
