"""BandTransport Protocol + the inbound message type.

Everything depends on this Protocol, never a concrete class — mock vs real Band
is a single flag. ``MockBand`` (default this round) and ``PhoenixBand`` [P7]
both implement it.
"""

from __future__ import annotations

from typing import AsyncIterator, Protocol, runtime_checkable

from pydantic import BaseModel

from alpha_oversight.contracts.band_envelope import Envelope


class Inbound(BaseModel):
    band_message_id: str
    room_id: str
    content: str


@runtime_checkable
class BandTransport(Protocol):
    async def send(self, room: str, env: Envelope, mention_peer: str) -> str:
        """Send a message; returns the band_message_id."""
        ...

    async def recv(self) -> Inbound:
        ...

    async def mark_processing(self, msg_id: str) -> None:
        ...

    async def mark_processed(self, msg_id: str) -> None:
        ...

    def drain_backlog(self) -> AsyncIterator[Inbound]:
        ...
