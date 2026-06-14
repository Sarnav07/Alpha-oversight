"""SSE stream routes — live + ``?replay=`` (one bus, ``desk`` field).

``GET /stream`` either tails the live ``EventBus`` (optionally filtered to one
``desk``) or, with ``?replay=<case>``, re-emits that case's recorded JSONL at the
original cadence via ``stream_replay`` — pixel-identical to live, the judge-facing
fallback. One endpoint, one bus, a ``desk`` field (the locked design — not two
buses).
"""

from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from alpha_oversight.orchestration.replay_writer import stream_replay

router = APIRouter()

_SSE_MEDIA = "text/event-stream"


async def _live(request: Request, desk: str | None) -> AsyncIterator[str]:
    bus = request.app.state.event_bus
    queue = bus.subscribe()
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"  # SSE comment heartbeat
                continue
            if desk and event.get("desk") != desk:
                continue
            yield f"data: {json.dumps(event, separators=(',', ':'))}\n\n"
    finally:
        bus.unsubscribe(queue)


@router.get("/stream")
async def stream(request: Request, desk: str | None = None, replay: str | None = None):
    """SSE: live desk-filtered events, or replay a recorded case at original cadence."""
    if replay:
        events_dir = request.app.state.events_dir
        return StreamingResponse(
            stream_replay(replay, events_dir), media_type=_SSE_MEDIA
        )
    return StreamingResponse(_live(request, desk), media_type=_SSE_MEDIA)
