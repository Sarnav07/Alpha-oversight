"""Replay tee — the submission video + live fallback.

Every EventBus event is also appended to ``events-<case>.jsonl`` at wall-clock
timestamps. ``stream_replay`` re-emits that JSONL over SSE at the original
cadence — pixel-identical to live.
"""

from __future__ import annotations

from typing import AsyncIterator

from alpha_oversight.reused.events import ActivityEvent


class ReplayWriter:
    def __init__(self, events_dir: str):
        self._events_dir = events_dir
        raise NotImplementedError

    async def tee(self, event: ActivityEvent) -> None:
        """Append the event to ``events-<case>.jsonl`` with a wall-clock ts."""
        raise NotImplementedError


async def stream_replay(case_id: str, events_dir: str) -> AsyncIterator[str]:
    """Yield ``"data: {json}\\n\\n"`` frames at the original cadence."""
    raise NotImplementedError
