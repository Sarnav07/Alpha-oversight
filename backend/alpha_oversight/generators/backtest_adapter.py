"""Bridge: order-event sequence -> quant backtest oracle [Phase 2].

The ONLY place the two order types meet. PLACE/FILL events become quant
``Order`` rows (CANCEL skipped). ``is_profitable_and_moved`` is R&D Oracle-2:
the sequence is economically real iff PnL>0 AND it moved price (slippage).
"""

from __future__ import annotations

from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.reused.quant.backtest_engine import DayMarketData
from alpha_oversight.reused.quant.contracts import Order as QuantOrder

# PnL is "real" only if some trade moved price by more than this (bps).
SLIPPAGE_THRESH_BPS: float = 5.0


def to_quant_orders(events: list[OrderEvent]) -> dict[int, list[QuantOrder]]:
    """PLACE/FILL -> quant Order; CANCEL skipped. Keyed by day_num."""
    raise NotImplementedError


def synth_market_data(symbols: list[str], days: int, seed: int) -> list[DayMarketData]:
    raise NotImplementedError


def is_profitable_and_moved(events: list[OrderEvent], seed: int = 0) -> bool:
    """R&D Oracle-2: PnL>0 AND any slippage_bps>SLIPPAGE_THRESH_BPS."""
    raise NotImplementedError
