"""Deterministic rule engine — the authoritative verdict (Phase-1A implementation).

``evaluate`` runs the active registry against an order-event sequence + the
debate-resolved contested inputs and returns ``Verdict{PASS|FLAG, rule_id,
cited_metric}``. The per-family metric functions return ``(tripped, metric)``.

The engine is the second independent oracle (design §6.2): no LLM overrules it.
The Prosecution/Defense debate is load-bearing only through ``ResolvedInputs`` —
specifically ``window_ms``, which, when set (>0), overrides each rule's own
window param at evaluation time. This is how "the debate sets the contested
inputs the engine can't derive" without any LLM grading an LLM.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.contracts.rule_contracts import Rule, RuleFamily, Verdict
from alpha_oversight.rules import (
    math_layering,
    math_marking,
    math_spoofing,
    math_wash_trade,
)

if TYPE_CHECKING:
    from alpha_oversight.contracts.case_contracts import ResolvedInputs


_FAMILY_METRIC: dict[RuleFamily, Callable[[list[OrderEvent], dict], tuple[bool, dict]]] = {
    RuleFamily.SPOOFING: math_spoofing.metric,
    RuleFamily.LAYERING: math_layering.metric,
    RuleFamily.WASH_TRADE: math_wash_trade.metric,
    RuleFamily.MARKING: math_marking.metric,
}


def _effective_params(rule: Rule, resolved_inputs: "ResolvedInputs | None") -> dict:
    """Overlay the debate-resolved contested inputs onto the rule's params.

    Only ``window_ms`` is treated as contested here (the engine input the debate
    sets). A resolved ``window_ms > 0`` widens/narrows the rule's window.
    """
    params = dict(rule.params)
    if resolved_inputs is not None:
        window = getattr(resolved_inputs, "window_ms", 0) or 0
        if window > 0:
            params["window_ms"] = window
    return params


def evaluate(
    events: list[OrderEvent],
    resolved_inputs: "ResolvedInputs",
    registry: list[Rule],
) -> Verdict:
    """Render the authoritative verdict. FLAG on the first ACTIVE rule that trips."""
    for rule in registry:
        if rule.status != "ACTIVE":
            continue
        metric_fn = _FAMILY_METRIC.get(rule.family)
        if metric_fn is None:
            continue
        params = _effective_params(rule, resolved_inputs)
        tripped, cited = metric_fn(events, params)
        if tripped:
            return Verdict(result="FLAG", rule_id=rule.id, cited_metric=cited)
    return Verdict(result="PASS", rule_id=None, cited_metric=None)


# ── Section-2 named family wrappers (delegate to the math_* modules) ──────────


def spoofing_metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    """Cancel timing vs opposite-side fills."""
    return math_spoofing.metric(events, params)


def layering_metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    """Sub-best-bid depth levels."""
    return math_layering.metric(events, params)


def wash_trade_metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    """Self-match ratio."""
    return math_wash_trade.metric(events, params)


def marking_metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    """End-of-day print spike."""
    return math_marking.metric(events, params)
