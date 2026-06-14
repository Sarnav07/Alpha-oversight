# LIFTED FROM quant_arena/src/simulation/cost_model.py:1 — import paths fixed to alpha_oversight.reused.quant.*
"""Square-root market impact cost model.

Total cost = 2 bps (fixed) + sigma*sqrt(order_value/ADV)*10000 (impact) + slippage (deterministic).
See spec Section 7.
"""
from __future__ import annotations

import hashlib
import random

import numpy as np

from alpha_oversight.reused.quant.contracts import Order

# Constants (from spec Section 7)
FIXED_BPS: float = 2.0
IMPACT_CAP_BPS: float = 50.0
FALLBACK_IMPACT_BPS: float = 10.0
SLIPPAGE_RANGE_BPS: float = 1.0
CROWDING_PENALTY_BPS: float = 1.5  # Extra cost when multiple models trade same stock same day


def _deterministic_slippage(ticker: str, date: str, side: str) -> float:
    """Compute slippage in [0, SLIPPAGE_RANGE_BPS] from a hash of (ticker, date, side).

    Why not use an RNG: a sequential RNG makes slippage on trade N depend on
    how many trades happened before it. Two models placing the same trade on
    the same day would get different slippage if they had different prior trade
    counts. This breaks benchmark fairness.

    Hash-based slippage guarantees: BUY 100 AAPL on 2023-01-03 always gets
    the same slippage, regardless of which model places it or what other
    trades happened before. Different stocks/days/sides get different values.
    Distribution is approximately uniform over [0, SLIPPAGE_RANGE_BPS].
    """
    key = f"{ticker}:{date}:{side}"
    h = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
    # Map to [0, 1) then scale to slippage range
    normalized = (h % 10_000) / 10_000.0
    return normalized * SLIPPAGE_RANGE_BPS


class CostModel:
    """Computes realistic fill prices using the square-root market impact model."""

    # Historical median VIX (1990-2023) for regime scaling
    MEDIAN_VIX: float = 17.0

    def compute(
        self,
        order: Order,
        base_price: float,
        daily_vol: float,
        adv: float,
        rng: random.Random,
        crowded: bool = False,
        vix_level: float | None = None,
        spread_bps: float | None = None,
        date: str = "",
    ) -> tuple[float, float, float]:
        """Compute fill price, fees, and total cost in bps.

        Args:
            order: The order being filled.
            base_price: Base price for the fill (today's VWAP for MARKET,
                        limit_price for LIMIT, stop_price for STOP).
            daily_vol: Stock's 20-day annualized daily volatility (e.g. 0.02).
            adv: Stock's 20-day average daily volume in USD.
            rng: Seeded RNG (kept for API compatibility, no longer used for slippage).
            crowded: If True, adds a crowding penalty (multiple models
                     trading the same stock on the same day).
            vix_level: Current VIX level. Scales spreads in high-vol regimes.
                       Real markets have 2-3x wider spreads during stress.
            spread_bps: Real bid/ask spread in bps from live market data.
                        When provided (live trading), uses half-spread as the
                        fixed cost component instead of the default 2 bps.
                        Backtesting passes None and uses the VIX-scaled default.
            date: Trading date string (YYYY-MM-DD) for deterministic slippage.

        Returns:
            (fill_price, fees_usd, total_bps)
        """
        order_value = order.qty * base_price

        # Component 1: Spread cost
        # Live trading: use real bid/ask half-spread (you pay half the spread
        # to cross from mid to the other side).
        # Backtesting: use fixed 2 bps scaled by VIX regime.
        if spread_bps is not None:
            # Half-spread: crossing the spread costs half (mid → bid or mid → ask)
            fixed_bps = spread_bps / 2.0
        else:
            if vix_level and vix_level > 0:
                vix_multiplier = max(0.8, min(2.5, vix_level / self.MEDIAN_VIX))
            else:
                vix_multiplier = 1.0
            fixed_bps = FIXED_BPS * vix_multiplier

        # Component 2: Square-root market impact
        if adv > 0:
            participation_rate = order_value / adv
            impact_bps = daily_vol * np.sqrt(participation_rate) * 10_000
            impact_bps = min(impact_bps, IMPACT_CAP_BPS)
        else:
            impact_bps = FALLBACK_IMPACT_BPS

        # Component 3: Deterministic slippage (always hurts the trader)
        # Hash of (ticker, date, side) → same trade always gets same slippage,
        # regardless of which model places it or prior trade count.
        slippage_bps = _deterministic_slippage(order.instrument, date, order.side)

        # Component 4: Crowding penalty (cross-instance market impact)
        # When multiple models trade the same stock on the same day,
        # the aggregate demand moves the price more than any single model.
        crowding_bps = CROWDING_PENALTY_BPS if crowded else 0.0

        total_bps = fixed_bps + impact_bps + slippage_bps + crowding_bps

        if order.side == "BUY":
            fill_price = base_price * (1 + total_bps / 10_000)
        else:
            fill_price = base_price * (1 - total_bps / 10_000)

        # Fees are already embedded in fill_price (BUY pays higher, SELL
        # receives lower).  Returning a separate fees amount would cause
        # PortfolioTracker.apply_fill to double-count costs because it
        # deducts both qty*fill_price AND fees.
        fees = 0.0
        return fill_price, fees, total_bps
