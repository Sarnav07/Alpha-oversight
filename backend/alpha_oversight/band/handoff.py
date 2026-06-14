"""BandHandoff — the one networked seam (over MockBand or PhoenixBand).

``send`` puts the envelope on the wire AND appends ``sha256(content)`` + the
band_message_id to the ledger AND publishes a desk-tagged EventBus event.
``pump`` is the inbound loop: recv -> mark_processing -> parse -> dedup by
msg_id -> dispatch -> mark_processed -> ledger.append -> bus.publish.

The ledger leaf binds the Band message: the appended entry carries
``sha256(content)`` and ``bmid`` (the real ``Ledger`` maps ``bmid`` ->
``band_message_id``), so the audit chain's leaves are Band message hashes.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Awaitable, Callable

from alpha_oversight.band.transport import BandTransport
from alpha_oversight.contracts.band_envelope import Envelope
from alpha_oversight.reused.events import ActivityEvent

if TYPE_CHECKING:
    from alpha_oversight.audit.ledger import Ledger
    from alpha_oversight.reused.events import EventBus


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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

    async def send(self, room: str, env: Envelope, peer: str) -> str:
        """Send + ledger.append(sha256(content), bmid) + bus.publish(desk)."""
        content = env.to_mention()
        bmid = await self._transport.send(room, env, peer)
        await self._record(env, content, bmid, direction="sent")
        return bmid

    async def pump(self, dispatch: Callable[[Envelope], Awaitable[None]]) -> None:
        """Drain the inbound backlog: ack each, dedup by msg_id, dispatch fresh ones.

        recv -> mark_processing -> parse -> if seen(msg_id): mark_processed; skip
              -> dispatch -> mark_processed -> ledger.append -> bus.publish(desk)
        """
        async for inbound in self._transport.drain_backlog():
            await self._transport.mark_processing(inbound.band_message_id)
            env = Envelope.parse_mention(inbound.content)
            if self._seen(env.msg_id):
                # Duplicate delivery: ACK so Band stops redelivering, then skip.
                await self._transport.mark_processed(inbound.band_message_id)
                continue
            await dispatch(env)
            await self._transport.mark_processed(inbound.band_message_id)
            await self._record(env, inbound.content, inbound.band_message_id, "recv")

    def _seen(self, msg_id: str) -> bool:
        """Idempotency check against the processed-id set (records on first sight)."""
        if msg_id in self._seen_ids:
            return True
        self._seen_ids.add(msg_id)
        return False

    # ── internals ────────────────────────────────────────────────────────────

    async def _record(
        self, env: Envelope, content: str, bmid: str, direction: str
    ) -> None:
        digest = hashlib.sha256(content.encode()).hexdigest()
        entry = {
            "case_id": env.case_id,
            "kind": env.kind.value,
            "from": env.from_,
            "to": env.to,
            "direction": direction,
            "sha256": digest,
            "bmid": bmid,
        }
        self._ledger.append(entry, self._ledger.head())
        event: ActivityEvent = {
            "agent_name": env.from_,
            "model_id": "",
            "desk": self._desk,
            "content": content,
            "reasoning": None,
            "tool_calls": [],
            "created_at": _now(),
        }
        await self._bus.publish(event)
