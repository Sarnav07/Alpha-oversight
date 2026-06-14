"""MockBand — in-process loopback implementing BandTransport (DEFAULT this round).

An asyncio.Queue mimics the @mention round-trip with the same identity-pair
semantics as real Band, so the whole choreography is testable without Phoenix.
"""

from __future__ import annotations

from typing import AsyncIterator

from alpha_oversight.band.transport import Inbound
from alpha_oversight.contracts.band_envelope import Envelope


class MockBand:
    def __init__(self) -> None:
        raise NotImplementedError

    async def send(self, room: str, env: Envelope, mention_peer: str) -> str:
        raise NotImplementedError

    async def recv(self) -> Inbound:
        raise NotImplementedError

    async def mark_processing(self, msg_id: str) -> None:
        raise NotImplementedError

    async def mark_processed(self, msg_id: str) -> None:
        raise NotImplementedError

    async def drain_backlog(self) -> AsyncIterator[Inbound]:
        raise NotImplementedError
