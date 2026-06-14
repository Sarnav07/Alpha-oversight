"""SanitizedBridge — the one-way Chinese-wall channel (events only).

Publishes R&D order-flow events into a Surveillance-only room. R&D *reasoning*
never crosses; the only reverse channel is the read-only rule registry.
"""

from __future__ import annotations

from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.contracts.order_events import OrderEvent


class SanitizedBridge:
    def __init__(self, handoff: BandHandoff, surveillance_room: str) -> None:
        self._handoff = handoff
        self._surveillance_room = surveillance_room
        raise NotImplementedError

    async def publish_flow(self, events: list[OrderEvent]) -> None:
        """Events ONLY — strips R&D reasoning (the structural Chinese wall)."""
        raise NotImplementedError
