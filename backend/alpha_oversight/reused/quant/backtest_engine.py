# LIFTED FROM quant_arena/src/simulation/backtest_engine.py:1 — import paths fixed to alpha_oversight.reused.quant.*
"""Day-by-day backtest engine.

Orchestrates: OrderValidator -> MarketSimulator -> PortfolioTracker.
Runs OUTSIDE the Docker container (trusted code).
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from alpha_oversight.reused.quant.contracts import Order, OHLCV
from alpha_oversight.reused.quant.cost_model import CostModel
from alpha_oversight.reused.quant.market_simulator import MarketSimulator
from alpha_oversight.reused.quant.order_validator import OrderValidator
from alpha_oversight.reused.quant.portfolio import PortfolioTracker


@dataclass
class DayMarketData:
    """Market data needed for one trading day."""
    day_num: int
    date: str
    ohlcv: dict[str, OHLCV]       # ticker -> today's OHLCV
    daily_vol: dict[str, float]    # ticker -> 20-day daily vol (std of returns)
    adv: dict[str, float]          # ticker -> 20-day avg daily volume USD
    vix_level: float | None = None # VIX for regime-scaled costs
    estimated_spread: dict[str, float] | None = None  # ticker -> Corwin-Schultz spread (bps)
    dividends: dict[str, float] | None = None  # ticker -> dividend per share (on ex-date)


@dataclass
class BacktestOutput:
    """Complete output from a backtest run."""
    daily_snapshots: list[dict] = field(default_factory=list)
    trades: list[dict] = field(default_factory=list)
    avg_holding_days: float = 0.0
    flatten_events: list[dict] = field(default_factory=list)  # margin-call liquidations


class BacktestEngine:
    """Runs the day-by-day simulation loop."""

    def __init__(
        self,
        starting_capital: float,
        universe: list[str],
        seed: int,
        borrow_rate_bps: float = 50.0,
    ):
        self.starting_capital = starting_capital
        self.portfolio = PortfolioTracker(starting_capital)
        self.cost_model = CostModel()
        self.market_sim = MarketSimulator(self.cost_model)
        self.order_validator = OrderValidator(universe, starting_capital)
        self.rng = random.Random(seed)
        self.borrow_rate_bps = borrow_rate_bps

    def run(
        self,
        orders_by_day: dict[int, list[Order]],
        market_data: list[DayMarketData],
    ) -> BacktestOutput:
        """Run backtest across all days.

        Args:
            orders_by_day: Mapping of day_num -> orders for that day.
            market_data: List of DayMarketData, one per trading day.

        Returns:
            BacktestOutput with daily snapshots, trade records, and flatten events.
        """
        output = BacktestOutput()

        for day_data in market_data:
            # Process T+2 settlements at start of day
            self.portfolio.process_settlements(day_data.day_num)

            # Credit dividends for positions held overnight (before any fills).
            # On ex-date, longs receive dividends, shorts owe them.
            # This must happen before fills because the dividend is earned from
            # the overnight position, not from today's trading.
            if day_data.dividends:
                for ticker, div_amount in day_data.dividends.items():
                    self.portfolio.credit_dividend(ticker, div_amount)

            orders_for_day = orders_by_day.get(day_data.day_num, [])
            day_trades = self._process_day(day_data, orders_for_day)
            output.trades.extend(day_trades)

            # Mark to market at close
            close_prices = {t: ohlcv.close for t, ohlcv in day_data.ohlcv.items()}
            self.portfolio.mark_to_market(close_prices)

            # Force-close positions for tickers with no data today (delisting,
            # merger, suspension). Uses last known price as the final price.
            for ticker in list(self.portfolio.positions_dict.keys()):
                if ticker not in day_data.ohlcv and ticker in self.portfolio.positions_dict:
                    pos_info = self.portfolio.positions_dict[ticker]
                    if pos_info["shares"] != 0:
                        from alpha_oversight.reused.quant.contracts import Fill
                        from datetime import datetime, timezone
                        side = "SELL" if pos_info["shares"] > 0 else "BUY"
                        delist_fill = Fill(
                            instrument=ticker,
                            side=side,
                            qty=abs(pos_info["shares"]),
                            fill_price=pos_info["current_price"],
                            fees=0.0,
                            timestamp=datetime.strptime(day_data.date, "%Y-%m-%d").replace(tzinfo=timezone.utc),
                            slippage_bps=0.0,
                        )
                        self.portfolio.apply_fill(delist_fill)
                        output.trades.append({
                            "day_num": day_data.day_num,
                            "date": day_data.date,
                            "ticker": ticker,
                            "side": side,
                            "qty": abs(pos_info["shares"]),
                            "order_type": "DELIST",
                            "limit_price": None,
                            "stop_price": None,
                            "fill_price": pos_info["current_price"],
                            "fees": 0.0,
                            "slippage_bps": 0.0,
                            "pnl_impact": None,
                            "rejected": False,
                            "rejection_reason": None,
                        })

            # Deduct daily borrow cost for short positions
            self.portfolio.deduct_daily_borrow_cost(self.borrow_rate_bps)

            # Margin-call circuit breaker: 25% drawdown → force-liquidate all positions.
            # Mirrors real broker behavior — you cannot lose more than ~25% of peak equity
            # before the broker closes everything.
            if self.portfolio.drawdown_from_peak >= 0.25 and self.portfolio.num_positions > 0:
                close_prices = {t: ohlcv.close for t, ohlcv in day_data.ohlcv.items()}
                flatten_fills = self.portfolio.flatten_all(close_prices)
                event = {
                    "day_num": day_data.day_num,
                    "date": day_data.date,
                    "drawdown_pct": self.portfolio.drawdown_from_peak * 100,
                    "positions_closed": len(flatten_fills),
                }
                output.flatten_events.append(event)
                for fill in flatten_fills:
                    output.trades.append({
                        "day_num": day_data.day_num,
                        "date": day_data.date,
                        "ticker": fill.instrument,
                        "side": fill.side,
                        "qty": fill.qty,
                        "order_type": "FLATTEN",
                        "limit_price": None,
                        "stop_price": None,
                        "fill_price": fill.fill_price,
                        "fees": fill.fees,
                        "slippage_bps": fill.slippage_bps,
                        "pnl_impact": None,
                        "rejected": False,
                        "rejection_reason": None,
                    })

            # Gross exposure circuit breaker: > 2x gross → force-reduce all positions.
            # Mirrors real broker margin enforcement when price drift pushes past limit.
            if self.portfolio.gross_exposure > 2.0 and self.portfolio.num_positions > 0:
                close_prices_ge = {t: ohlcv.close for t, ohlcv in day_data.ohlcv.items()}
                flatten_fills_ge = self.portfolio.flatten_all(close_prices_ge)
                event = {
                    "day_num": day_data.day_num,
                    "date": day_data.date,
                    "gross_exposure_pct": self.portfolio.gross_exposure * 100,
                    "trigger": "gross_exposure_2x",
                    "positions_closed": len(flatten_fills_ge),
                }
                output.flatten_events.append(event)
                for fill in flatten_fills_ge:
                    output.trades.append({
                        "day_num": day_data.day_num,
                        "date": day_data.date,
                        "ticker": fill.instrument,
                        "side": fill.side,
                        "qty": fill.qty,
                        "order_type": "FLATTEN_GROSS",
                        "limit_price": None,
                        "stop_price": None,
                        "fill_price": fill.fill_price,
                        "fees": fill.fees,
                        "slippage_bps": fill.slippage_bps,
                        "pnl_impact": None,
                        "rejected": False,
                        "rejection_reason": None,
                    })

            # Save daily snapshot
            output.daily_snapshots.append({
                "day_num": day_data.day_num,
                "date": day_data.date,
                "portfolio_value": self.portfolio.total_value,
                "cash": self.portfolio.cash,
                "gross_exposure": self.portfolio.gross_exposure,
                "net_exposure": self.portfolio.net_exposure,
                "num_positions": self.portfolio.num_positions,
                "unrealized_pnl": self.portfolio.unrealized_pnl,
                "realized_pnl": self.portfolio.realized_pnl,
                "total_fees_paid": self.portfolio.total_fees_paid,
                "drawdown_pct": self.portfolio.drawdown_from_peak,
            })

        output.avg_holding_days = self.portfolio.avg_holding_days
        return output

    def _process_day(
        self,
        day_data: DayMarketData,
        orders: list[Order],
    ) -> list[dict]:
        """Validate and fill orders for one day. Returns trade records."""
        trades: list[dict] = []

        # Use today's open price for all stocks — consistent with fill prices.
        # Previously used yesterday's close for held positions, which caused
        # position limit checks to use stale prices that diverge from fill price.
        ref_prices: dict[str, float] = {}
        for t, ohlcv in day_data.ohlcv.items():
            ref_prices[t] = ohlcv.open
        # For held stocks missing from today's data, fall back to last known price
        for ticker, pos_info in self.portfolio.positions_dict.items():
            if ticker not in ref_prices:
                ref_prices[ticker] = pos_info["current_price"]

        for order in orders:
            trade_record: dict[str, Any] = {
                "day_num": day_data.day_num,
                "date": day_data.date,
                "ticker": order.instrument,
                "side": order.side,
                "qty": order.qty,
                "order_type": order.order_type,
                "limit_price": order.limit_price,
                "stop_price": order.stop_price,
                "fill_price": None,
                "fees": 0.0,
                "slippage_bps": 0.0,
                "rejected": False,
                "rejection_reason": None,
            }

            # Validate
            valid, reason = self.order_validator.validate(
                order,
                current_positions=self.portfolio.positions_dict,
                portfolio_value=self.portfolio.total_value,
                gross_exposure_value=self.portfolio.gross_exposure_value,
                ref_prices=ref_prices,
                available_cash=self.portfolio.buying_power,
            )
            if not valid:
                trade_record["rejected"] = True
                trade_record["rejection_reason"] = reason
                trades.append(trade_record)
                continue

            # Check that we have OHLCV data for this stock
            if order.instrument not in day_data.ohlcv:
                trade_record["rejected"] = True
                trade_record["rejection_reason"] = f"No market data for {order.instrument}"
                trades.append(trade_record)
                continue

            # Fill
            # Get estimated spread if available (Corwin-Schultz from H/L data)
            _spread = None
            if day_data.estimated_spread:
                _spread = day_data.estimated_spread.get(order.instrument)

            fill = self.market_sim.fill(
                order,
                ohlcv=day_data.ohlcv[order.instrument],
                daily_vol=day_data.daily_vol.get(order.instrument, 0.02),
                adv=day_data.adv.get(order.instrument, 1_000_000_000),
                rng=self.rng,
                day_num=day_data.day_num,
                date=day_data.date,
                vix_level=day_data.vix_level,
                spread_bps=_spread,
            )
            if fill is None:
                # LIMIT/STOP not triggered -- no trade record
                continue

            # Compute P&L impact of this trade for win/loss tracking.
            # Only position-CLOSING trades get a pnl_impact value:
            #   SELL reducing a long, BUY covering a short.
            # Position-OPENING trades get pnl_impact=None so they don't dilute win rate.
            if order.side == "SELL" and order.instrument in self.portfolio.positions_dict:
                pos_info = self.portfolio.positions_dict[order.instrument]
                if pos_info["shares"] > 0:
                    # Closing/reducing a long: profit if sold above avg cost
                    avg_cost = pos_info["avg_cost"]
                    pnl_impact = fill.qty * (fill.fill_price - avg_cost)
                else:
                    pnl_impact = None  # Opening/adding to a short — no realized P&L
            elif order.side == "BUY" and order.instrument in self.portfolio.positions_dict:
                pos_info = self.portfolio.positions_dict[order.instrument]
                if pos_info["shares"] < 0:
                    # Covering a short: profit if bought back cheaper than sold
                    avg_cost = pos_info["avg_cost"]
                    pnl_impact = fill.qty * (avg_cost - fill.fill_price)
                else:
                    pnl_impact = None  # Adding to a long — no realized P&L
            elif order.side == "BUY":
                pnl_impact = None  # Opening a new long — no realized P&L
            elif order.side == "SELL":
                pnl_impact = None  # Opening a new short — no realized P&L
            else:
                pnl_impact = None

            # Cost is baked into fill_price by CostModel (fixed bps + impact +
            # slippage + crowding). Re-derive the dollar cost from the bps so
            # the trade record carries a real, non-zero cost number. Using
            # fill_price as the price base introduces a ~bps² error (negligible).
            cost_usd = fill.qty * fill.fill_price * fill.slippage_bps / 10_000.0
            self.portfolio.apply_fill(fill)
            trade_record["fill_price"] = fill.fill_price
            trade_record["fees"] = cost_usd
            trade_record["slippage_bps"] = fill.slippage_bps
            trade_record["pnl_impact"] = (pnl_impact - cost_usd) if pnl_impact is not None else None
            trades.append(trade_record)

        return trades
