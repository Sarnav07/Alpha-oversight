"""Deterministic rule engine — the authoritative verdict (Phase-1A implementation).

``evaluate`` runs the active registry against an order-event sequence + the
debate-resolved contested inputs and returns ``Verdict{PASS|FLAG, rule_id,
cited_metric}``. The per-family metric functions return ``(tripped, metric)``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.contracts.rule_contracts import Rule, Verdict

if TYPE_CHECKING:
    from alpha_oversight.contracts.case_contracts import ResolvedInputs


def evaluate(
    events: list[OrderEvent],
    resolved_inputs: "ResolvedInputs",
    registry: list[Rule],
) -> Verdict:
    raise NotImplementedError


def spoofing_metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    """Cancel timing vs opposite-side fills."""
    raise NotImplementedError


def layering_metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    """Sub-best-bid depth levels."""
    raise NotImplementedError


def wash_trade_metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    """Self-match ratio."""
    raise NotImplementedError


def marking_metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    """End-of-day print spike."""
    raise NotImplementedError
