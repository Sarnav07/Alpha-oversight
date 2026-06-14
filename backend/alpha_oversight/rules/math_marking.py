"""Marking-the-close family metric (Phase-1A implementation).

Marking = a late-session trade printed specifically to move the closing/marked
price (e.g. to flatter a portfolio mark). The tell is an end-of-day FILL whose
price jumps away from the prior reference print by more than a threshold.

Pure deterministic math; returns (tripped, cited_metric).

``params``:
  min_print_move_bps float  trip threshold on the EOD price move in basis points
  eod_after_ms       int    optional wall-ms cutoff after which fills are "EOD";
                            when absent, the last fill is treated as the close.
"""

from __future__ import annotations

from alpha_oversight.contracts.order_events import OrderAction, OrderEvent

_DEFAULT_MIN_PRINT_MOVE_BPS = 100.0  # 1%


def metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    min_move_bps = float(params.get("min_print_move_bps", _DEFAULT_MIN_PRINT_MOVE_BPS))
    eod_after_ms = params.get("eod_after_ms")

    fills = [
        ev
        for ev in events
        if ev.action is OrderAction.FILL and ev.order.avg_fill_price > 0
    ]
    fills.sort(key=lambda e: e.timestamp)

    if len(fills) < 2:
        return False, {"eod_print_move_bps": 0.0, "threshold": min_move_bps}

    close = fills[-1]
    if eod_after_ms is not None:
        ms = close.timestamp.timestamp() * 1000.0
        if ms < float(eod_after_ms):
            return False, {"eod_print_move_bps": 0.0, "threshold": min_move_bps}

    ref_price = fills[-2].order.avg_fill_price
    close_price = close.order.avg_fill_price
    move_bps = abs(close_price - ref_price) / ref_price * 1e4 if ref_price else 0.0

    tripped = move_bps >= min_move_bps
    metric_out = {
        "eod_print_move_bps": round(move_bps, 6),
        "ref_price": ref_price,
        "close_price": close_price,
        "threshold": min_move_bps,
    }
    return tripped, metric_out
