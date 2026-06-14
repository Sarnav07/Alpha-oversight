"""Bridge: order-event sequence -> quant backtest oracle [Phase 2].

The ONLY place the two order types meet. PLACE/FILL events become quant
``Order`` rows (CANCEL skipped). ``is_profitable_and_moved`` is R&D Oracle-2:
the sequence is economically real iff PnL>0 AND it moved price (slippage).
"""

from __future__ import annotations

import math
import random

from alpha_oversight.contracts.order_events import OrderAction, OrderEvent
from alpha_oversight.reused.quant.backtest_engine import BacktestEngine, DayMarketData
from alpha_oversight.reused.quant.contracts import OHLCV
from alpha_oversight.reused.quant.contracts import Order as QuantOrder

# PnL is "real" only if some trade moved price by more than this (bps).
SLIPPAGE_THRESH_BPS: float = 5.0

# Events that put a fillable order into the backtest. CANCEL/MODIFY do not
# place size into the book the oracle simulates, so they are skipped.
_FILLABLE: frozenset[OrderAction] = frozenset({OrderAction.PLACE, OrderAction.FILL})

# ExchangeOrder.OrderType has STOP_LIMIT, which the quant Order's Literal does
# not; map it to the nearest fillable type the simulator understands.
_TYPE_MAP: dict[str, str] = {
    "MARKET": "MARKET",
    "LIMIT": "LIMIT",
    "STOP": "STOP",
    "STOP_LIMIT": "STOP",
}

# Synthetic-market constants tuned so a large block (vs ADV) clears the slippage
# threshold while a steady up-drift keeps a buy-low/sell-high exit profitable.
_BASE_PRICE: float = 10.0
_DAILY_DRIFT: float = 0.05      # +5%/day mean drift -> exits beat entries
_DAILY_VOL: float = 0.03        # 20-day daily vol fed to the impact model
_ADV_USD: float = 5_000_000.0   # small ADV -> sqrt-impact bites on big blocks


def _day_num(event: OrderEvent, origin_ordinal: int) -> int:
    """Backtest day index = calendar-day offset from the first event's date."""
    return event.timestamp.date().toordinal() - origin_ordinal


def to_quant_orders(events: list[OrderEvent]) -> dict[int, list[QuantOrder]]:
    """PLACE/FILL -> quant Order; CANCEL (and MODIFY) skipped. Keyed by day_num.

    Field translation across the two order types (the load-bearing seam):
      ExchangeOrder.symbol     -> Order.instrument
      ExchangeOrder.quantity   -> Order.qty
      ExchangeOrder.side  (Side enum)      -> Order.side  (Literal "BUY"/"SELL")
      ExchangeOrder.order_type (OrderType) -> Order.order_type (Literal)
    """
    fillable = [e for e in events if e.action in _FILLABLE]
    if not fillable:
        return {}

    origin_ordinal = min(e.timestamp.date().toordinal() for e in fillable)

    by_day: dict[int, list[QuantOrder]] = {}
    for event in fillable:
        o = event.order
        order = QuantOrder(
            instrument=o.symbol,
            side=o.side.value,                       # Side enum -> "BUY"/"SELL"
            qty=o.quantity,                          # quantity -> qty
            order_type=_TYPE_MAP[o.order_type.value],  # OrderType -> Literal
            limit_price=o.limit_price,
            stop_price=o.stop_price,
        )
        by_day.setdefault(_day_num(event, origin_ordinal), []).append(order)
    return by_day


def synth_market_data(symbols: list[str], days: int, seed: int) -> list[DayMarketData]:
    """Deterministic synthetic OHLCV + daily_vol + adv, one entry per day.

    Each symbol follows a seeded geometric up-drift with small per-day noise, so
    a buy-early / sell-late sequence is profitable and the path is reproducible
    for a fixed ``seed``. ADV is small enough that large blocks incur real
    square-root market impact.
    """
    rng = random.Random(seed)
    # Independent price path per symbol (advance the RNG per symbol per day).
    prices: dict[str, float] = {s: _BASE_PRICE for s in symbols}

    out: list[DayMarketData] = []
    for day in range(days):
        ohlcv: dict[str, OHLCV] = {}
        daily_vol: dict[str, float] = {}
        adv: dict[str, float] = {}
        for s in symbols:
            prev = prices[s]
            noise = rng.uniform(-0.5, 0.5) * _DAILY_VOL  # symmetric daily noise
            close = prev * (1.0 + _DAILY_DRIFT + noise)
            open_ = prev
            high = max(open_, close) * 1.002
            low = min(open_, close) * 0.998
            vwap = (open_ + close) / 2.0
            ohlcv[s] = OHLCV(
                open=open_, high=high, low=low, close=close,
                volume=int(_ADV_USD / max(close, 0.01)), vwap=vwap,
            )
            daily_vol[s] = _DAILY_VOL
            adv[s] = _ADV_USD
            prices[s] = close
        out.append(
            DayMarketData(
                day_num=day,
                date=f"2026-06-{day + 1:02d}",
                ohlcv=ohlcv,
                daily_vol=daily_vol,
                adv=adv,
            )
        )
    return out


def is_profitable_and_moved(events: list[OrderEvent], seed: int = 0) -> bool:
    """R&D Oracle-2: True iff closing-trade PnL>0 AND any slippage_bps>THRESH.

    Runs the real ``BacktestEngine`` over the translated orders and a synthetic
    market sized to span the order timeline. "Profitable" sums ``pnl_impact``
    over position-CLOSING trades (the only ones the engine scores); "moved"
    means at least one filled trade incurred more than ``SLIPPAGE_THRESH_BPS``.
    """
    orders_by_day = to_quant_orders(events)
    if not orders_by_day:
        return False

    symbols = sorted({o.instrument for day in orders_by_day.values() for o in day})
    days = max(orders_by_day) + 1
    market_data = synth_market_data(symbols, days=days, seed=seed)

    engine = BacktestEngine(starting_capital=1_000_000, universe=symbols, seed=seed)
    output = engine.run(orders_by_day, market_data)

    closing_pnl = sum(
        t["pnl_impact"] for t in output.trades if t.get("pnl_impact") is not None
    )
    moved = any(
        (t.get("slippage_bps") or 0.0) > SLIPPAGE_THRESH_BPS
        for t in output.trades
        if not t.get("rejected")
    )
    return closing_pnl > 0 and moved
