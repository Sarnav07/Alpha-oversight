"""PhoenixBand — the real Band transport over Phoenix Channels WS [Phase 7].

Stub only this round; everything runs on MockBand behind the BandTransport
Protocol. Wired last, behind the USE_REAL_BAND flag.
"""

from __future__ import annotations

from typing import AsyncIterator

from alpha_oversight.band.transport import Inbound
from alpha_oversight.contracts.band_envelope import Envelope


class PhoenixBand:
    def __init__(self, base_url: str, api_key: str, ws_url: str, identity: str) -> None:
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
