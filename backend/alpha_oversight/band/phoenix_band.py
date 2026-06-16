"""PhoenixBand — the real Band transport [Phase 7].

Implements ``BandTransport`` against Band's Agent REST API
(``https://app.band.ai/api/v1/agent``). Runs in **REST-poll mode**: inbound
messages are pulled from ``GET /chats/{room}/messages/next`` (Band's own
"next message to process" queue, which already excludes processed messages), so
no Phoenix-Channels websocket / heartbeat is required. This is the robust path
the design names as the reliable fallback to the websocket (``risk #1``); the
``ws_url`` arg is accepted for signature/forward compatibility but unused here.

Mapping to Band's API (all under ``{base}/agent``, header ``X-API-Key``):
  - ``send``           -> ``POST /chats/{room}/messages`` with
                          ``{"message": {"content": "@h …json", "mentions": [{id}]}}``
                          → returns ``data.id`` (the band_message_id).
  - ``recv`` / backlog -> ``GET  /chats/{room}/messages/next`` (per configured room)
                          → ``data`` is the next unprocessed ``ChatMessage`` or null.
  - ``mark_processing``-> ``POST /chats/{room}/messages/{id}/processing``
  - ``mark_processed`` -> ``POST /chats/{room}/messages/{id}/processed``

Mentions require the peer's Band id (uuid); ``send`` resolves a handle → id via
``GET /agent/peers`` (cached) so the orchestration can keep passing logical
handles. A value that already looks like a uuid (or is in ``peer_overrides``) is
used directly.
"""

from __future__ import annotations

import asyncio
import re
from typing import AsyncIterator

import httpx

from alpha_oversight.band.transport import Inbound
from alpha_oversight.contracts.band_envelope import Envelope

_UUID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)


class PhoenixBand:
    """One real Band identity (REST-poll mode) implementing ``BandTransport``."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        ws_url: str,
        identity: str,
        *,
        agent_id: str = "",
        rooms: list[str] | None = None,
        peer_overrides: dict[str, str] | None = None,
        default_mention: str = "",
        poll_interval: float = 0.8,
        recv_timeout: float = 90.0,
    ) -> None:
        # The code addresses absolute "/api/v1/agent/..." paths, so the client base
        # must be the host root. Accept a base given as the host, ".../api/v1", or
        # ".../api/v1/agent" and normalize all three down to the host.
        root = base_url.rstrip("/")
        for suffix in ("/api/v1/agent", "/api/v1", "/agent"):
            if root.endswith(suffix):
                root = root[: -len(suffix)]
                break
        self._root = root
        self._ws_url = ws_url  # unused in REST-poll mode
        self.identity = identity
        self._agent_id = agent_id
        self._rooms = list(rooms or [])
        self._poll = poll_interval
        self._recv_timeout = recv_timeout
        self._client = httpx.AsyncClient(
            base_url=root,
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            timeout=30.0,
        )
        self._msg_room: dict[str, str] = {}  # band_message_id -> chat_id (for ACKs)
        self._peer_id: dict[str, str] = dict(peer_overrides or {})  # handle/name -> uuid
        self._default_mention = default_mention  # fallback peer id for internal roles
        self._peers_loaded = False

    # ── identity / discovery ────────────────────────────────────────────────
    async def me(self) -> dict:
        r = await self._client.get("/api/v1/agent/me")
        r.raise_for_status()
        return r.json().get("data", r.json())

    async def _load_peers(self) -> None:
        if self._peers_loaded:
            return
        r = await self._client.get("/api/v1/agent/peers")
        r.raise_for_status()
        for p in r.json().get("data", []):
            pid = p.get("id")
            if not pid:
                continue
            for k in (p.get("handle"), p.get("name")):
                if k:
                    self._peer_id.setdefault(str(k), pid)
                    # also index the bare slug after the last "/"
                    if "/" in str(k):
                        self._peer_id.setdefault(str(k).rsplit("/", 1)[-1], pid)
        self._peers_loaded = True

    async def _resolve_peer(self, peer: str) -> str:
        """Map a logical handle/name to a Band peer id (uuid)."""
        if _UUID.match(peer):
            return peer
        if peer in self._peer_id:
            return self._peer_id[peer]
        await self._load_peers()
        if peer in self._peer_id:
            return self._peer_id[peer]
        # last resort: case-insensitive contains match against known peers
        low = peer.lower()
        for k, v in self._peer_id.items():
            if low in k.lower():
                return v
        raise KeyError(
            f"cannot resolve Band peer {peer!r}; known: {sorted(self._peer_id)}"
        )

    # ── BandTransport ───────────────────────────────────────────────────────
    async def send(self, room: str, env: Envelope, mention_peer: str) -> str:
        """POST the envelope to ``room``; @mention ``mention_peer`` when it resolves
        to a real Band identity, else post unmentioned. Returns the band_message_id.

        Cross-desk hops (R&D->Surveillance via the bridge) and the human escalation
        resolve to real peers and carry a real @mention. The surveillance desk's
        *internal* sub-agent steps (specialist, prosecution, adjudicator, ...) are
        not separate Band identities — they post to the case room as the desk's
        on-Band audit trail with no mention. Either way the envelope JSON in the
        body carries from_/to/kind and the returned id binds the ledger leaf.
        """
        try:
            pid = await self._resolve_peer(mention_peer)
        except KeyError:
            # Internal sub-agent role (specialist/prosecution/...) is not a separate
            # Band identity, and Band requires a non-self mention (>=1 entry). Address
            # the desk's audit step to the human overseer — the one participant we may
            # always mention without breaching the Chinese wall (never the other desk).
            if not self._default_mention:
                raise
            pid = self._default_mention
        mentions = [{"id": pid, "handle": mention_peer}]
        body = {"message": {"content": env.to_mention(), "mentions": mentions}}
        r = await self._client.post(f"/api/v1/agent/chats/{room}/messages", json=body)
        r.raise_for_status()
        return r.json()["data"]["id"]

    async def _poll_once(self) -> Inbound | None:
        """Pull the next unprocessed message across the configured rooms (or None)."""
        for room in self._rooms:
            r = await self._client.get(f"/api/v1/agent/chats/{room}/messages/next")
            if r.status_code in (204, 404):
                continue
            r.raise_for_status()
            data = (r.json() or {}).get("data")
            if not data:
                continue
            mid = data["id"]
            chat = data.get("chat_room_id", room)
            self._msg_room[mid] = chat
            # Skip our own messages (ACK so Band's queue advances past them).
            if self._agent_id and data.get("sender_id") == self._agent_id:
                await self.mark_processed(mid)
                continue
            return Inbound(
                band_message_id=mid, room_id=chat, content=data.get("content", "")
            )
        return None

    async def recv(self) -> Inbound:
        """Block (polling) until a fresh inbound arrives or recv_timeout elapses."""
        waited = 0.0
        while True:
            ib = await self._poll_once()
            if ib is not None:
                return ib
            if waited >= self._recv_timeout:
                raise TimeoutError(
                    f"{self.identity}: no Band message within {self._recv_timeout}s"
                )
            await asyncio.sleep(self._poll)
            waited += self._poll

    async def drain_backlog(self) -> AsyncIterator[Inbound]:
        """Yield every currently-pending message, then stop (crash-recovery shape)."""
        while True:
            ib = await self._poll_once()
            if ib is None:
                return
            yield ib

    async def mark_processing(self, msg_id: str) -> None:
        room = self._msg_room.get(msg_id)
        if room:
            await self._client.post(
                f"/api/v1/agent/chats/{room}/messages/{msg_id}/processing"
            )

    async def mark_processed(self, msg_id: str) -> None:
        room = self._msg_room.get(msg_id)
        if room:
            await self._client.post(
                f"/api/v1/agent/chats/{room}/messages/{msg_id}/processed"
            )

    async def aclose(self) -> None:
        await self._client.aclose()
