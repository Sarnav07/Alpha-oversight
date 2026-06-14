# LIFTED FROM quant_arena/src/contracts/trading_contracts.py:1 — verbatim.
"""Trading contracts: Order and Fill (the backtest oracle's input/output types).

NOTE: this quant ``Order`` is frozen with ``Literal`` side — distinct from the
mutable ``ExchangeOrder`` (Side enum) on the Band wire. They meet only in the
backtest adapter.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class Order(BaseModel):
    """A trading order submitted by the strategy."""
    model_config = ConfigDict(frozen=True)

    instrument: str
    side: Literal["BUY", "SELL"]
    qty: int
    order_type: Literal["MARKET", "LIMIT", "STOP"]
    limit_price: float | None = None
    stop_price: float | None = None


class Fill(BaseModel):
    """Result of an executed order."""
    model_config = ConfigDict(frozen=True)

    instrument: str
    side: Literal["BUY", "SELL"]
    qty: int
    fill_price: float
    fees: float  # Always 0.0 — costs are embedded in fill_price
    timestamp: datetime
    slippage_bps: float  # Total cost in bps (fixed + impact + slippage + crowding)
