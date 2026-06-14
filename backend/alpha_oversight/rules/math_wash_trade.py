"""Wash-trade family metric (Phase-1A implementation).

Wash trade = a trader buys and sells the same instrument against itself,
creating volume with no real change of beneficial ownership. The tell is a high
self-match ratio: the share of filled volume where the same ``trader_id`` is
active on both sides of the book at the same price.

Pure deterministic math; returns (tripped, cited_metric).

``params``:
  min_self_match_ratio float  trip threshold on self_matched_qty / total_filled_qty
"""

from __future__ import annotations

from collections import defaultdict

from alpha_oversight.contracts.exchange_contracts import Side
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent

_DEFAULT_MIN_SELF_MATCH_RATIO = 0.5


def metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    min_ratio = float(params.get("min_self_match_ratio", _DEFAULT_MIN_SELF_MATCH_RATIO))

    # Per (trader, symbol, price): filled qty on each side. A self-match is the
    # min of the two sides — the qty a trader crossed against itself.
    buy_qty: dict[tuple[str, str, float], int] = defaultdict(int)
    sell_qty: dict[tuple[str, str, float], int] = defaultdict(int)
    total_filled = 0

    for ev in events:
        if ev.action is not OrderAction.FILL:
            continue
        total_filled += ev.order.quantity
        key = (ev.trader_id, ev.order.symbol, ev.order.limit_price or 0.0)
        if ev.order.side is Side.BUY:
            buy_qty[key] += ev.order.quantity
        else:
            sell_qty[key] += ev.order.quantity

    self_matched = 0
    for key in set(buy_qty) | set(sell_qty):
        self_matched += min(buy_qty.get(key, 0), sell_qty.get(key, 0))

    ratio = (self_matched / total_filled) if total_filled > 0 else 0.0
    tripped = ratio >= min_ratio
    metric_out = {
        "self_match_ratio": round(ratio, 6),
        "self_matched_qty": self_matched,
        "total_filled_qty": total_filled,
        "threshold": min_ratio,
    }
    return tripped, metric_out
