"""Layering family metric (Phase-1A implementation).

Layering = stack multiple non-bona-fide orders at several distinct price levels
on one side to fake depth/pressure, then pull them. The tell is N>=k distinct
price levels placed on one side and cancelled together inside a tight window.

The window is the contested input the Beat-B evasion exploits: spreading the
cancels across ~400ms slips a 100ms seed rule. ``ResolvedInputs.window_ms`` (set
by the debate) overrides ``params['window_ms']`` in the engine.

Pure deterministic math; returns (tripped, cited_metric).

``params``:
  window_ms        int  max ms span of the cancelled cluster on one side
  min_depth_levels int  trip threshold on the count of distinct price levels
"""

from __future__ import annotations

from alpha_oversight.contracts.exchange_contracts import Side
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent

_DEFAULT_WINDOW_MS = 100
_DEFAULT_MIN_DEPTH_LEVELS = 3


def _ms(ts) -> float:
    return ts.timestamp() * 1000.0


def metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    window_ms = float(params.get("window_ms", _DEFAULT_WINDOW_MS))
    min_depth_levels = int(params.get("min_depth_levels", _DEFAULT_MIN_DEPTH_LEVELS))

    placed: dict[str, OrderEvent] = {}
    for ev in events:
        if ev.action is OrderAction.PLACE:
            placed[ev.order.order_id] = ev

    # Cancelled, layered orders grouped by side: (price_level, cancel_ms).
    cancelled_by_side: dict[Side, list[tuple[float, float]]] = {
        Side.BUY: [],
        Side.SELL: [],
    }
    for ev in events:
        if ev.action is OrderAction.CANCEL and ev.order.order_id in placed:
            price = ev.order.limit_price
            if price is None:
                continue
            cancelled_by_side[ev.order.side].append((price, _ms(ev.timestamp)))

    best_levels = 0
    best_span = 0.0
    best_side = None
    for side, items in cancelled_by_side.items():
        if not items:
            continue
        distinct_levels = len({p for p, _ in items})
        cancel_times = [t for _, t in items]
        span = max(cancel_times) - min(cancel_times)
        if distinct_levels > best_levels:
            best_levels = distinct_levels
            best_span = span
            best_side = side

    # Trip only when both the depth threshold is met AND the cancelled cluster
    # is tight enough to fit the window (the timing the evasion stretches).
    tripped = best_levels >= min_depth_levels and best_span <= window_ms
    metric_out = {
        "depth_levels": best_levels,
        "cancel_span_ms": round(best_span, 6),
        "layer_side": best_side.value if best_side else None,
        "window_ms": window_ms,
        "threshold": min_depth_levels,
    }
    return tripped, metric_out
