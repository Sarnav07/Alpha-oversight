"""R&D co-evolution loop [Phase 5].

The adversary proposes an order-event sequence; Oracle-1 (rule engine) checks
it MISSES the current registry; Oracle-2 (backtest) checks it's economically
real. A sequence that evades AND profits is a confirmed novel evasion handed
across the bridge. Bounded to K rounds. Stub only at Phase 0.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from alpha_oversight.contracts.order_events import OrderEvent

if TYPE_CHECKING:
    from alpha_oversight.band.bridge import SanitizedBridge
    from alpha_oversight.rules.registry import RuleRegistryStore


async def run_rnd_round(
    bridge: "SanitizedBridge",
    registry: "RuleRegistryStore",
    max_rounds: int = 5,
    seed: int = 0,
) -> list[OrderEvent]:
    """Return the first sequence that both evades the registry and profits."""
    raise NotImplementedError
