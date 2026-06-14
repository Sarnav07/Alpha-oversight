"""Surveillance choreography on Band — the Phase-4 milestone.

detector -> investigator -> recruit (@mention via handoff) -> specialist ->
Prosecution/Defense (<=N rounds, staged to respect the Featherless 4-slot
semaphore) -> adjudicator -> engine.evaluate -> escalation. Transitions are
persisted to the CaseStore and every step is tee'd to the replay writer.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from alpha_oversight.contracts.order_events import OrderEvent

if TYPE_CHECKING:
    from alpha_oversight.audit.ledger import Ledger
    from alpha_oversight.band.handoff import BandHandoff
    from alpha_oversight.reused.events import EventBus
    from alpha_oversight.rules.registry import RuleRegistryStore
    from alpha_oversight.state.case_store import CaseStore
    from alpha_oversight.state.state_machine import Case


async def run_surveillance(
    events: list[OrderEvent],
    handoff: "BandHandoff",
    store: "CaseStore",
    registry: "RuleRegistryStore",
    bus: "EventBus",
    ledger: "Ledger",
) -> "Case":
    raise NotImplementedError
