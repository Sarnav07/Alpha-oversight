# LIFTED FROM quant_arena/src/simulation/order_validator.py:1 — import paths fixed to alpha_oversight.reused.quant.*
"""Order sanity validation.

Checks: qty > 0, universe membership, valid reference price, BUY cash sufficiency.
Enforces: qty, universe, price availability, cash sufficiency, 2x gross exposure limit.
"""
from __future__ import annotations

from alpha_oversight.reused.quant.contracts import Order


class OrderValidator:
    """Validates that an order is fillable. Enforces risk limits."""

    def __init__(self, universe: list[str], starting_capital: float):
        self.universe = set(universe)
        self.starting_capital = starting_capital

    def validate(
        self,
        order: Order,
        current_positions: dict[str, dict],
        portfolio_value: float,
        gross_exposure_value: float,
        ref_prices: dict[str, float],
        available_cash: float | None = None,
    ) -> tuple[bool, str | None]:
        """Validate that an order is fillable.

        Args:
            order: The order to validate.
            current_positions: Current positions dict (ticker -> {shares, avg_cost, ...}).
                Used for gross exposure pre-trade check.
            portfolio_value: Total portfolio value (equity). Used for gross exposure limit.
            gross_exposure_value: Current gross exposure in dollars. Used for gross
                exposure pre-trade check.
            ref_prices: Reference prices for cash check and exposure calculation.
            available_cash: Buying power, for BUY cash sufficiency.

        Returns:
            (is_valid, rejection_reason) -- reason is None if valid.
        """
        if order.qty <= 0:
            return False, "Order qty must be positive"

        if order.instrument not in self.universe:
            return False, f"{order.instrument} is not in the tradeable universe"

        price = ref_prices.get(order.instrument, 0)
        if price <= 0:
            return False, f"No valid reference price for {order.instrument}"

        # Cash sufficiency check (only for BUY orders that increase exposure)
        if order.side == "BUY" and available_cash is not None:
            order_cost = order.qty * price
            if order_cost > available_cash * 1.05:  # 5% buffer for costs
                return False, (
                    f"Insufficient cash: order costs ${order_cost:,.0f} "
                    f"but only ${available_cash:,.0f} available"
                )

        # Gross exposure pre-trade check: reject orders that would push gross
        # exposure above 2x portfolio value. Mirrors real broker pre-trade risk.
        current_shares = (current_positions.get(order.instrument) or {}).get("shares", 0)
        if order.side == "BUY":
            new_shares = current_shares + order.qty
        else:
            new_shares = current_shares - order.qty
        delta_gross = abs(new_shares) * price - abs(current_shares) * price
        projected_gross_value = gross_exposure_value + delta_gross
        if portfolio_value > 0 and projected_gross_value / portfolio_value > 2.0:
            return False, (
                f"Gross exposure limit: order would push gross to "
                f"{projected_gross_value / portfolio_value:.2f}x (limit 2.0x)"
            )

        return True, None
