"""Live rule codification + regression gate [Phase 5].

On human-confirm, derive a new parameterized rule from a case and INSERT it,
then replay the evasion through the new registry and assert it now FLAGs.
Stub only at Phase 0 — implemented in Phase 5.
"""

from __future__ import annotations

from alpha_oversight.contracts.case_contracts import ResolvedInputs
from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.contracts.rule_contracts import Rule
from alpha_oversight.rules.registry import RuleRegistryStore


def derive_rule(case_id: str, resolved: ResolvedInputs, family: str) -> Rule:
    """Build a new parameterized rule from a confirmed case."""
    raise NotImplementedError


def codify_and_gate(
    rule: Rule,
    events: list[OrderEvent],
    resolved: ResolvedInputs,
    registry: RuleRegistryStore,
) -> bool:
    """Codify the rule then assert the evasion now trips. Returns True on regression pass."""
    raise NotImplementedError
