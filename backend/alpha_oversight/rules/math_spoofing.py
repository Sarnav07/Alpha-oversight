"""Spoofing family metric (Phase-1A implementation).

Spoofing = enter a large non-bona-fide order on one side to push price, then
CANCEL it quickly once the opposite-side (genuine) order fills. The tell is a
high cancel-to-fill ratio on the spoof side, with the cancels landing within a
tight window of the opposite-side fills.

Pure deterministic math over the order-event sequence. Returns
(tripped, cited_metric); the engine wraps it into a Verdict.

``params``:
  window_ms       int   max ms between a spoof-side cancel and an opposite fill
  min_cancel_ratio float trip threshold on cancelled_qty / placed_qty (spoof side)
"""

from __future__ import annotations

from alpha_oversight.contracts.exchange_contracts import Side
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent

_DEFAULT_WINDOW_MS = 100
_DEFAULT_MIN_CANCEL_RATIO = 0.8


def _ms(ts) -> float:
    return ts.timestamp() * 1000.0


def metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    window_ms = float(params.get("window_ms", _DEFAULT_WINDOW_MS))
    min_cancel_ratio = float(params.get("min_cancel_ratio", _DEFAULT_MIN_CANCEL_RATIO))

    # Opposite-side fills (the genuine side the spoof is trying to help).
    fills_by_side: dict[Side, list[float]] = {Side.BUY: [], Side.SELL: []}
    for ev in events:
        if ev.action is OrderAction.FILL:
            fills_by_side[ev.order.side].append(_ms(ev.timestamp))

    placed_qty: dict[Side, int] = {Side.BUY: 0, Side.SELL: 0}
    # Sum cancelled quantity on each side whose cancel is "near" an opposite fill.
    near_cancel_qty: dict[Side, int] = {Side.BUY: 0, Side.SELL: 0}
    cancel_qty: dict[Side, int] = {Side.BUY: 0, Side.SELL: 0}

    for ev in events:
        side = ev.order.side
        if ev.action is OrderAction.PLACE:
            placed_qty[side] += ev.order.quantity
        elif ev.action is OrderAction.CANCEL:
            cancel_qty[side] += ev.order.quantity
            opp = Side.SELL if side is Side.BUY else Side.BUY
            cts = _ms(ev.timestamp)
            if any(abs(cts - f) <= window_ms for f in fills_by_side[opp]):
                near_cancel_qty[side] += ev.order.quantity

    best_side = None
    best_ratio = 0.0
    best_near_ratio = 0.0
    for side in (Side.BUY, Side.SELL):
        if placed_qty[side] <= 0:
            continue
        ratio = cancel_qty[side] / placed_qty[side]
        near_ratio = near_cancel_qty[side] / placed_qty[side]
        # Pick the side with the strongest *near-opposite-fill* cancel signal.
        if near_ratio > best_near_ratio or (
            near_ratio == best_near_ratio and ratio > best_ratio
        ):
            best_side = side
            best_ratio = ratio
            best_near_ratio = near_ratio

    tripped = best_side is not None and best_near_ratio >= min_cancel_ratio
    metric_out = {
        "cancel_ratio": round(best_ratio, 6),
        "near_fill_cancel_ratio": round(best_near_ratio, 6),
        "spoof_side": best_side.value if best_side else None,
        "window_ms": window_ms,
        "threshold": min_cancel_ratio,
    }
    return tripped, metric_out
