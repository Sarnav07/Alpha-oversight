"""SanitizedBridge — the one-way Chinese-wall channel (events only).

Publishes R&D order-flow events into a Surveillance-only room as a HANDOFF
envelope. The R&D *reasoning* (and the adversary's model identity) is stripped
from every order before it crosses; the only reverse channel is the read-only
rule registry. Riding ``BandHandoff.send`` means the crossing is also ledgered
and mirrored to the EventBus.
"""

from __future__ import annotations

from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.contracts.band_envelope import BandKind, Envelope
from alpha_oversight.contracts.order_events import OrderEvent


class SanitizedBridge:
    def __init__(self, handoff: BandHandoff, surveillance_room: str) -> None:
        self._handoff = handoff
        self._surveillance_room = surveillance_room

    async def publish_flow(self, events: list[OrderEvent]) -> None:
        """Events ONLY — strips R&D reasoning (the structural Chinese wall)."""
        sanitized = [self._strip(ev) for ev in events]
        env = Envelope(
            case_id=self._surveillance_room,
            from_="bridge",
            to="anomaly-detector",
            kind=BandKind.HANDOFF,
            payload={"events": [ev.model_dump(mode="json") for ev in sanitized]},
        )
        await self._handoff.send(self._surveillance_room, env, peer="anomaly-detector")

    @staticmethod
    def _strip(ev: OrderEvent) -> OrderEvent:
        """Return a copy with R&D-side leakage (reasoning, model_key) removed."""
        clean = ev.model_copy(deep=True)
        clean.order.reasoning = ""
        clean.order.model_key = ""
        return clean
