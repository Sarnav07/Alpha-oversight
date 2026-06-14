# LIFTED FROM trader-arena/arena/exchange/contracts.py:1 — verbatim (self-contained: stdlib + pydantic v2).
"""Exchange data contracts — orders, fills, quotes, and market depth.

All models are Pydantic v2 BaseModel. ExchangeOrder is mutable (status
updates, partial fills). OrderFill and Quote are effectively immutable
after creation.

This is the Band/surveillance WIRE order type. It is intentionally distinct
from the quant ``Order`` (frozen, Literal side) used by the backtest oracle —
the two meet ONLY in ``generators/backtest_adapter.py``. Never unify them.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, computed_field


# ── Enums ──


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    STOP_LIMIT = "STOP_LIMIT"


class OrderStatus(str, Enum):
    PENDING = "PENDING"  # Created, not yet sent to matching engine
    OPEN = "OPEN"  # In the order book, waiting for fill
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"  # DAY order expired at market close
    REJECTED = "REJECTED"  # Failed risk check


class TimeInForce(str, Enum):
    DAY = "DAY"  # Expires at market close
    GTC = "GTC"  # Good till cancelled


# ── Order Fill ──


class OrderFill(BaseModel):
    """A single (partial) fill on an order."""

    fill_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    symbol: str
    side: Side
    quantity: int
    fill_price: float
    commission: float  # Dollar amount
    slippage: float  # Dollar amount of slippage cost
    timestamp: datetime
    notional_value: float

    @classmethod
    def create(
        cls,
        order_id: str,
        symbol: str,
        side: Side,
        quantity: int,
        fill_price: float,
        commission: float,
        slippage: float,
        timestamp: datetime | None = None,
    ) -> OrderFill:
        ts = timestamp or datetime.now(timezone.utc)
        return cls(
            order_id=order_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            fill_price=fill_price,
            commission=commission,
            slippage=slippage,
            timestamp=ts,
            notional_value=fill_price * quantity,
        )


# ── Exchange Order ──


class ExchangeOrder(BaseModel):
    """Full-lifecycle order with status tracking and partial fill support."""

    order_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    side: Side
    quantity: int = Field(ge=1)
    order_type: OrderType
    limit_price: float | None = None
    stop_price: float | None = None
    time_in_force: TimeInForce = TimeInForce.DAY
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: int = 0
    avg_fill_price: float = 0.0
    fills: list[OrderFill] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reasoning: str = ""
    model_key: str = ""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def remaining_quantity(self) -> int:
        return self.quantity - self.filled_quantity

    def record_fill(self, fill: OrderFill) -> None:
        """Record a fill and update aggregates."""
        self.fills.append(fill)
        old_notional = self.avg_fill_price * self.filled_quantity
        new_notional = fill.fill_price * fill.quantity
        self.filled_quantity += fill.quantity
        if self.filled_quantity > 0:
            self.avg_fill_price = (old_notional + new_notional) / self.filled_quantity

        if self.filled_quantity >= self.quantity:
            self.status = OrderStatus.FILLED
        elif self.filled_quantity > 0:
            self.status = OrderStatus.PARTIALLY_FILLED

        self.updated_at = datetime.now(timezone.utc)

    def cancel(self) -> None:
        """Mark order as cancelled."""
        self.status = OrderStatus.CANCELLED
        self.updated_at = datetime.now(timezone.utc)

    def expire(self) -> None:
        """Mark order as expired (DAY order at market close)."""
        self.status = OrderStatus.EXPIRED
        self.updated_at = datetime.now(timezone.utc)

    def reject(self, reason: str = "") -> None:
        """Mark order as rejected."""
        self.status = OrderStatus.REJECTED
        self.reasoning = reason if reason else self.reasoning
        self.updated_at = datetime.now(timezone.utc)

    @property
    def is_active(self) -> bool:
        return self.status in (
            OrderStatus.OPEN,
            OrderStatus.PENDING,
            OrderStatus.PARTIALLY_FILLED,
        )


# ── Market Data ──


class Quote(BaseModel):
    """Real-time quote synthesized from historical bars."""

    symbol: str
    bid: float
    ask: float
    bid_size: int = 0  # Shares available at bid
    ask_size: int = 0  # Shares available at ask
    last_price: float = 0.0
    volume: int = 0  # Today's cumulative volume
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field  # type: ignore[prop-decorator]
    @property
    def spread(self) -> float:
        return round(self.ask - self.bid, 6)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def mid_price(self) -> float:
        return round((self.bid + self.ask) / 2, 6)


class BookLevel(BaseModel):
    """One price level in synthetic market depth."""

    price: float
    quantity: int  # Shares available at this level


class MarketDepth(BaseModel):
    """Synthetic order book depth derived from real volume data.

    Bids sorted price DESC (best bid first).
    Asks sorted price ASC (best ask first).
    """

    symbol: str
    bids: list[BookLevel] = Field(default_factory=list)
    asks: list[BookLevel] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @computed_field  # type: ignore[prop-decorator]
    @property
    def best_bid(self) -> float:
        return self.bids[0].price if self.bids else 0.0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def best_ask(self) -> float:
        return self.asks[0].price if self.asks else 0.0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def spread(self) -> float:
        if self.bids and self.asks:
            return round(self.best_ask - self.best_bid, 6)
        return 0.0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def mid_price(self) -> float:
        if self.bids and self.asks:
            return round((self.best_bid + self.best_ask) / 2, 6)
        return 0.0


# ── Modify Request ──


class ModifyRequest(BaseModel):
    """Request to modify an existing open order."""

    order_id: str
    new_quantity: int | None = None
    new_limit_price: float | None = None
    new_stop_price: float | None = None
