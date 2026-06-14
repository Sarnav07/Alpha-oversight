"""Demo trigger routes — Beat-A (known pattern) and Beat-B (novel evasion)."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.post("/demo/beat-a")
async def demo_beat_a():
    """Inject a known clean pattern -> instant FLAGGED."""
    raise NotImplementedError


@router.post("/demo/beat-b")
async def demo_beat_b():
    """Inject the novel evasion -> PASS -> ESCALATED -> human."""
    raise NotImplementedError
