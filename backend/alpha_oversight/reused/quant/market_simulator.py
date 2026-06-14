# LIFTED FROM quant_arena/src/simulation/market_simulator.py:1 — import paths fixed to alpha_oversight.reused.quant.*
"""Order fill logic for MARKET, LIMIT, and STOP orders.

MARKET: fills at today's open + cost model.
LIMIT BUY: fills if LOW <= limit_price. LIMIT SELL: fills if HIGH >= limit_price.
STOP BUY: triggers if HIGH >= stop_price. STOP SELL: triggers if LOW <= stop_price.
See spec Section 6.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

from alpha_oversight.reused.quant.contracts import Order, Fill, OHLCV
from alpha_oversight.reused.quant.cost_model import CostModel


class MarketSimulator:
    """Simulates order fills with realistic market microstructure."""

    def __init__(self, cost_model: CostModel):
        self.cost_model = cost_model

    def fill(
        self,
        order: Order,
        ohlcv: OHLCV,
        daily_vol: float,
        adv: float,
        rng: random.Random,
        day_num: int,
        date: str,
        vix_level: float | None = None,
        crowded: bool = False,
        spread_bps: float | None = None,
    ) -> Fill | None:
        """Attempt to fill an order using today's OHLCV data.

        Returns a Fill if the order executes, None if it doesn't
        (LIMIT/STOP not triggered).
        """
        if order.order_type == "MARKET":
            base_price = ohlcv.vwap if ohlcv.vwap is not None else ohlcv.open
        elif order.order_type == "LIMIT":
            if not self._limit_triggered(order, ohlcv):
                return None
            base_price = order.limit_price
        elif order.order_type == "STOP":
            if not self._stop_triggered(order, ohlcv):
                return None
            base_price = order.stop_price
        else:
            return None

        fill_price, fees, total_bps = self.cost_model.compute(
            order, base_price=base_price, daily_vol=daily_vol, adv=adv, rng=rng,
            crowded=crowded, vix_level=vix_level, spread_bps=spread_bps,
            date=date,
        )

        return Fill(
            instrument=order.instrument,
            side=order.side,
            qty=order.qty,
            fill_price=fill_price,
            fees=fees,
            timestamp=datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc),
            slippage_bps=total_bps,
        )

    @staticmethod
    def _limit_triggered(order: Order, ohlcv: OHLCV) -> bool:
        if order.side == "BUY":
            return ohlcv.low <= order.limit_price
        else:
            return ohlcv.high >= order.limit_price

    @staticmethod
    def _stop_triggered(order: Order, ohlcv: OHLCV) -> bool:
        if order.side == "BUY":
            return ohlcv.high >= order.stop_price
        else:
            return ohlcv.low <= order.stop_price
