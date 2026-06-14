"""BandHandoff — the one networked seam (over MockBand or PhoenixBand).

``send`` puts the envelope on the wire AND appends ``sha256(content)`` + the
band_message_id to the ledger and publishes a desk-tagged EventBus event.
``pump`` is the inbound loop: recv -> mark_processing -> parse -> dedup by
msg_id -> dispatch -> mark_processed -> ledger.append -> bus.publish.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Awaitable, Callable

from alpha_oversight.band.transport import BandTransport
from alpha_oversight.contracts.band_envelope import Envelope

if TYPE_CHECKING:
    from alpha_oversight.audit.ledger import Ledger
    from alpha_oversight.reused.events import EventBus


class BandHandoff:
    def __init__(
        self,
        transport: BandTransport,
        ledger: "Ledger",
        bus: "EventBus",
        desk: str,
    ) -> None:
        self._transport = transport
        self._ledger = ledger
        self._bus = bus
        self._desk = desk
        self._seen_ids: set[str] = set()
        raise NotImplementedError

    async def send(self, room: str, env: Envelope, peer: str) -> str:
        """Send + ledger.append(sha256(content), bmid) + bus.publish(desk)."""
        raise NotImplementedError

    async def pump(self, dispatch: Callable[[Envelope], Awaitable[None]]) -> None:
        raise NotImplementedError

    def _seen(self, msg_id: str) -> bool:
        """Idempotency check against the processed-id set."""
        raise NotImplementedError
