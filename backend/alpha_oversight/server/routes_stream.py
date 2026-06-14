"""SSE stream routes — live + ``?replay=`` (one bus, ``desk`` field)."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/stream")
async def stream(desk: str | None = None, replay: str | None = None):
    """SSE: live desk-filtered events, or replay a recorded case at original cadence."""
    raise NotImplementedError
