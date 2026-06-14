# LIFTED FROM quant_arena/src/contracts/data_contracts.py — TRIMMED to the pandas-free subset.
# DROPPED: EquitySnapshot/StockIndicators/Fundamental/Earnings/Macro (pull in pandas / unused by the oracle).
"""Market-data contracts used by the backtest oracle.

Only ``OHLCV``, ``Position``, ``Portfolio`` are carried over — these are the
contracts the backtest engine + portfolio tracker actually need. The original
``EquitySnapshot`` imported pandas (``dict[str, pd.DataFrame]``); pandas is not
a project dependency, so that model is intentionally omitted.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class OHLCV(BaseModel):
    """One day's price data for one stock."""
    model_config = ConfigDict(frozen=True)

    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: float | None = None


class Position(BaseModel):
    """One position in the portfolio."""
    model_config = ConfigDict(frozen=True)

    ticker: str
    shares: int
    avg_cost: float
    current_price: float
    unrealized_pnl: float
    weight_pct: float
    sector: str
    days_held: int


class Portfolio(BaseModel):
    """Current portfolio state as of yesterday's close."""
    model_config = ConfigDict(frozen=True)

    positions: dict[str, Position]
    cash: float
    total_value: float
    unrealized_pnl: float
    realized_pnl: float
    gross_exposure: float
    net_exposure: float
    drawdown_from_peak: float
    peak_value: float
    total_trades: int
    total_fees_paid: float
    num_positions: int
    beta_to_spx: float | None = None
