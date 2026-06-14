# LIFTED FROM quant_arena/src/simulation/portfolio.py:1 — import paths fixed to alpha_oversight.reused.quant.*
"""Mutable portfolio state tracker for simulation.

Tracks positions (long/short), cash, realized P&L, peak value, drawdown.
Produces frozen Portfolio snapshots for EquitySnapshot consumption.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from alpha_oversight.reused.quant.contracts import Fill, Portfolio, Position


@dataclass
class _MutablePosition:
    """Internal mutable position state."""
    shares: int  # positive=long, negative=short
    avg_cost: float
    current_price: float
    days_held: int = 0


class PortfolioTracker:
    """Mutable portfolio for use inside simulation loops."""

    def __init__(self, starting_capital: float):
        self._starting_capital = starting_capital
        self._cash: float = starting_capital
        self._positions: dict[str, _MutablePosition] = {}
        self._peak_value: float = starting_capital
        self._realized_pnl: float = 0.0
        self._total_trades: int = 0
        self._total_fees: float = 0.0
        self._pending_settlements: list[dict] = []  # {"amount": float, "settles_on_day": int}
        self._current_day: int = 0
        self._closed_holding_days: list[int] = []  # Track holding duration of closed positions

    # ---- Properties ----

    @property
    def cash(self) -> float:
        return self._cash

    @property
    def num_positions(self) -> int:
        return len(self._positions)

    @property
    def total_value(self) -> float:
        position_value = sum(
            p.shares * p.current_price for p in self._positions.values()
        )
        return self._cash + position_value

    @property
    def gross_exposure(self) -> float:
        tv = self.total_value
        if tv == 0:
            return 0.0
        return self.gross_exposure_value / tv

    @property
    def gross_exposure_value(self) -> float:
        return sum(abs(p.shares * p.current_price) for p in self._positions.values())

    @property
    def net_exposure(self) -> float:
        tv = self.total_value
        if tv == 0:
            return 0.0
        net = sum(p.shares * p.current_price for p in self._positions.values())
        return net / tv

    @property
    def realized_pnl(self) -> float:
        return self._realized_pnl

    @property
    def avg_holding_days(self) -> float:
        """Average holding period of closed positions in trading days."""
        if not self._closed_holding_days:
            return 0.0
        return float(sum(self._closed_holding_days) / len(self._closed_holding_days))

    @property
    def peak_value(self) -> float:
        return self._peak_value

    @property
    def total_fees_paid(self) -> float:
        return self._total_fees

    @property
    def unrealized_pnl(self) -> float:
        return sum(
            p.shares * (p.current_price - p.avg_cost)
            for p in self._positions.values()
        )

    @property
    def drawdown_from_peak(self) -> float:
        if self._peak_value <= 0:
            return 0.0
        return 1.0 - self.total_value / self._peak_value

    @property
    def buying_power(self) -> float:
        """Cash available for buying = cash - unsettled sell proceeds."""
        pending = sum(s["amount"] for s in self._pending_settlements)
        return self._cash - pending

    def process_settlements(self, current_day: int) -> float:
        """Process settlements that have reached T+2. Returns amount settled."""
        self._current_day = current_day
        settled = 0.0
        remaining = []
        for s in self._pending_settlements:
            if current_day >= s["settles_on_day"]:
                settled += s["amount"]
            else:
                remaining.append(s)
        self._pending_settlements = remaining
        return settled

    # ---- Mutation methods ----

    def apply_fill(self, fill: Fill) -> None:
        """Update portfolio state from a fill."""
        ticker = fill.instrument
        signed_qty = fill.qty if fill.side == "BUY" else -fill.qty

        if ticker not in self._positions:
            self._positions[ticker] = _MutablePosition(
                shares=0, avg_cost=0.0, current_price=fill.fill_price,
            )

        pos = self._positions[ticker]
        old_shares = pos.shares
        new_shares = old_shares + signed_qty

        # Realize P&L on closed shares and record holding period (partial or full close)
        if old_shares != 0 and (
            (old_shares > 0 and signed_qty < 0) or (old_shares < 0 and signed_qty > 0)
        ):
            closed_qty = min(abs(signed_qty), abs(old_shares))
            if old_shares > 0:
                self._realized_pnl += closed_qty * (fill.fill_price - pos.avg_cost)
            else:
                self._realized_pnl += closed_qty * (pos.avg_cost - fill.fill_price)
            # Record holding period for every reduction (partial or full close).
            # Strategies that never fully exit still show meaningful avg_holding_days.
            self._closed_holding_days.append(pos.days_held)

        # Update avg_cost
        if new_shares != 0:
            if old_shares == 0 or (old_shares > 0) != (new_shares > 0):
                # New position or crossed zero -- new cost basis
                pos.avg_cost = fill.fill_price
            elif (old_shares > 0 and signed_qty > 0) or (old_shares < 0 and signed_qty < 0):
                # Same direction -- weighted average
                pos.avg_cost = (
                    abs(old_shares) * pos.avg_cost + abs(signed_qty) * fill.fill_price
                ) / abs(new_shares)
            # else: reducing position, keep avg_cost

        pos.shares = new_shares
        pos.current_price = fill.fill_price

        if new_shares == 0:
            del self._positions[ticker]

        # Update cash: BUY costs money, SELL earns money
        if fill.side == "BUY":
            self._cash -= fill.qty * fill.fill_price + fill.fees
        else:
            proceeds = fill.qty * fill.fill_price - fill.fees
            self._cash += proceeds
            # T+2 settlement: if closing a long position, proceeds are
            # not available as buying power for 2 business days.
            if old_shares > 0:
                settled_qty = min(fill.qty, old_shares)
                settled_proceeds = settled_qty * fill.fill_price
                self._pending_settlements.append({
                    "amount": settled_proceeds,
                    "settles_on_day": self._current_day + 2,
                })

        self._total_fees += fill.fees
        self._total_trades += 1

    def apply_split(self, ticker: str, ratio: float) -> bool:
        """Adjust position for a stock split.

        A 10:1 split means ratio=10: shares multiply by 10, avg_cost divides by 10.
        A 1:4 reverse split means ratio=0.25: shares divide by 4, avg_cost multiplies by 4.

        Returns True if position was adjusted, False if no position held.
        """
        pos = self._positions.get(ticker)
        if pos is None or pos.shares == 0 or ratio <= 0:
            return False
        pos.shares = int(pos.shares * ratio)
        pos.avg_cost = pos.avg_cost / ratio
        pos.current_price = pos.current_price / ratio
        return True

    def credit_dividend(self, ticker: str, amount_per_share: float) -> float:
        """Credit or debit dividend for a held position on ex-date.

        Long positions receive dividends (cash credit).
        Short positions owe dividends to the lender (cash debit).
        Returns net amount (positive = received, negative = paid).
        """
        pos = self._positions.get(ticker)
        if pos is None or pos.shares == 0:
            return 0.0
        # shares > 0 → long → receive dividend
        # shares < 0 → short → pay dividend to lender
        income = pos.shares * amount_per_share
        self._cash += income
        return income

    def deduct_daily_borrow_cost(self, borrow_rate_annual_bps: float = 50.0) -> float:
        """Deduct daily borrow cost for all short positions.

        Called once per trading day during mark-to-market.
        Cost = abs(short_position_value) * rate / 252

        Args:
            borrow_rate_annual_bps: Annual borrow rate in basis points (50 = 0.50%)

        Returns:
            Total borrow cost deducted today
        """
        daily_rate = (borrow_rate_annual_bps / 10_000) / 252
        total_cost = 0.0
        for ticker, pos in self._positions.items():
            if pos.shares < 0:  # Short position
                short_value = abs(pos.shares * pos.current_price)
                cost = short_value * daily_rate
                self._cash -= cost
                self._total_fees += cost
                total_cost += cost
        return total_cost

    def mark_to_market(self, prices: dict[str, float]) -> None:
        """Update positions to closing prices and advance days_held."""
        for ticker, pos in self._positions.items():
            if ticker in prices:
                pos.current_price = prices[ticker]
            pos.days_held += 1

        # Update peak
        tv = self.total_value
        if tv > self._peak_value:
            self._peak_value = tv

    def flatten_all(self, close_prices: dict[str, float]) -> list[Fill]:
        """Liquidate all positions at close prices. Returns fills.

        Applies a 5 bps spread cost to fill prices (BUY pays more, SELL
        receives less) so flatten exits are not unrealistically free.
        """
        FLATTEN_COST_BPS = 5.0
        fills = []
        for ticker, pos in list(self._positions.items()):
            price = close_prices.get(ticker, pos.current_price)
            side = "SELL" if pos.shares > 0 else "BUY"
            # Apply spread cost: BUY costs more, SELL receives less
            if side == "BUY":
                fill_price = price * (1 + FLATTEN_COST_BPS / 10_000)
            else:
                fill_price = price * (1 - FLATTEN_COST_BPS / 10_000)
            fill = Fill(
                instrument=ticker,
                side=side,
                qty=abs(pos.shares),
                fill_price=fill_price,
                fees=0.0,
                timestamp=datetime.now(timezone.utc),
                slippage_bps=FLATTEN_COST_BPS,
            )
            self.apply_fill(fill)
            fills.append(fill)
        return fills

    def get_position(self, ticker: str) -> dict | None:
        """Get position info as dict, or None if not held."""
        pos = self._positions.get(ticker)
        if pos is None:
            return None
        unrealized = pos.shares * (pos.current_price - pos.avg_cost)
        tv = self.total_value
        weight = abs(pos.shares * pos.current_price) / tv * 100 if tv > 0 else 0.0
        return {
            "shares": pos.shares,
            "avg_cost": pos.avg_cost,
            "current_price": pos.current_price,
            "days_held": pos.days_held,
            "unrealized_pnl": unrealized,
            "weight_pct": weight,
        }

    @property
    def positions_dict(self) -> dict[str, dict]:
        """All positions as dicts (for OrderValidator)."""
        return {t: self.get_position(t) for t in self._positions}

    def to_snapshot(self, sectors: dict[str, str] | None = None) -> Portfolio:
        """Create a frozen Portfolio contract from current state."""
        sectors = sectors or {}
        tv = self.total_value

        positions = {}
        for ticker, pos in self._positions.items():
            weight = abs(pos.shares * pos.current_price) / tv if tv else 0.0
            positions[ticker] = Position(
                ticker=ticker,
                shares=pos.shares,
                avg_cost=pos.avg_cost,
                current_price=pos.current_price,
                unrealized_pnl=pos.shares * (pos.current_price - pos.avg_cost),
                weight_pct=weight * 100,
                sector=sectors.get(ticker, ""),
                days_held=pos.days_held,
            )

        return Portfolio(
            positions=positions,
            cash=self._cash,
            total_value=tv,
            unrealized_pnl=self.unrealized_pnl,
            realized_pnl=self._realized_pnl,
            gross_exposure=self.gross_exposure,
            net_exposure=self.net_exposure,
            drawdown_from_peak=self.drawdown_from_peak,
            peak_value=self._peak_value,
            total_trades=self._total_trades,
            total_fees_paid=self._total_fees,
            num_positions=self.num_positions,
        )
