"""MockBand — in-process loopback implementing BandTransport (DEFAULT this round).

A shared in-process broker (per-identity asyncio.Queue inboxes + one message
counter) mimics the @mention round-trip with the *same two-identity semantics*
as real Band: a message ``send``\\ -ed by identity A mentioning peer B lands in
B's inbox, never A's. Each identity is one ``MockBand`` (one ``BandTransport``);
``MockBand.pair`` wires a connected R&D <-> Surveillance pair on one broker.

Lifecycle (``mark_processing`` / ``mark_processed``) is recorded per receiving
identity, mirroring Band's ``/processing`` + ``/processed`` ACKs. No Phoenix WS,
no network — the whole choreography is testable without real Band.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator

from alpha_oversight.band.transport import Inbound
from alpha_oversight.contracts.band_envelope import Envelope


class _Broker:
    """Shared in-process routing fabric for a set of MockBand identities."""

    def __init__(self) -> None:
        self.inboxes: dict[str, asyncio.Queue[Inbound]] = {}
        self._counter = 0

    def register(self, identity: str) -> asyncio.Queue[Inbound]:
        return self.inboxes.setdefault(identity, asyncio.Queue())

    def next_id(self) -> str:
        self._counter += 1
        return f"mb-{self._counter}"

    def deliver(self, peer: str, inbound: Inbound) -> None:
        # Auto-register an unseen peer so a one-sided send still routes.
        self.register(peer).put_nowait(inbound)


class MockBand:
    """One Band identity on a shared in-process broker."""

    def __init__(self, identity: str = "self", broker: _Broker | None = None) -> None:
        self.identity = identity
        self._broker = broker if broker is not None else _Broker()
        self._inbox = self._broker.register(identity)
        self.processing: list[str] = []
        self.processed: list[str] = []

    @classmethod
    def pair(cls, a: str, b: str) -> tuple["MockBand", "MockBand"]:
        """Two identities connected through one shared broker."""
        broker = _Broker()
        return cls(a, broker), cls(b, broker)

    async def send(self, room: str, env: Envelope, mention_peer: str) -> str:
        """Enqueue into the mentioned *peer's* inbox; return the band_message_id."""
        bmid = self._broker.next_id()
        inbound = Inbound(
            band_message_id=bmid, room_id=room, content=env.to_mention()
        )
        self._broker.deliver(mention_peer, inbound)
        return bmid

    async def recv(self) -> Inbound:
        return await self._inbox.get()

    async def mark_processing(self, msg_id: str) -> None:
        self.processing.append(msg_id)

    async def mark_processed(self, msg_id: str) -> None:
        self.processed.append(msg_id)

    async def drain_backlog(self) -> AsyncIterator[Inbound]:
        """Yield everything already queued (crash-recovery), then stop."""
        while not self._inbox.empty():
            yield self._inbox.get_nowait()
