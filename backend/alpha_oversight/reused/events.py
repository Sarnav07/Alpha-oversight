# LIFTED FROM prediction-arena/backend/src/core/events.py:1 — EventBus; ActivityEvent EXTENDED with `desk` (Phase 0).
"""In-memory event bus for broadcasting real-time events to SSE clients.

One bus, desk-tagged (R&D vs Surveillance) per the locked design — not two
buses. ``ActivityEvent`` gains a ``desk`` field so the viewer can colour the
topology graph and the replay writer can tee per case.
"""

import asyncio
import logging
from typing import TypedDict

logger = logging.getLogger(__name__)


class ActivityEvent(TypedDict):
    agent_name: str
    model_id: str
    desk: str  # Phase-0 extension: "rnd" | "surveillance"
    content: str | None
    reasoning: str | None
    tool_calls: list[dict]
    created_at: str


class EventBus:
    """Simple pub/sub for broadcasting events to SSE subscribers."""

    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue[ActivityEvent]] = []

    def subscribe(self) -> asyncio.Queue[ActivityEvent]:
        q: asyncio.Queue[ActivityEvent] = asyncio.Queue(maxsize=100)
        self._subscribers.append(q)
        logger.debug("SSE subscriber added (total=%d)", len(self._subscribers))
        return q

    def unsubscribe(self, q: asyncio.Queue[ActivityEvent]) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass
        logger.debug("SSE subscriber removed (total=%d)", len(self._subscribers))

    async def publish(self, event: ActivityEvent) -> None:
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Slow consumer — drop oldest event
                try:
                    q.get_nowait()
                    q.put_nowait(event)
                except asyncio.QueueEmpty:
                    pass
