"""Replay tee — the submission video + live fallback.

Every EventBus event the pipeline emits is also appended to ``events-<case>.jsonl``
with a wall-clock timestamp. ``stream_replay`` re-emits that JSONL over SSE at the
original cadence (the gaps between successive ``created_at`` stamps) — so a replay
is pixel-identical to the live run and always works for judges.

``ActivityEvent`` carries no ``case_id``, so ``tee`` takes it explicitly (the
pipeline knows the case); each line is the event dict plus a ``replay_ts`` wall
clock written at tee time. One JSONL file per case keeps replays trivially
seekable and lets a recorded Beat-B stand in if a live step stalls.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import AsyncIterator

from alpha_oversight.reused.events import ActivityEvent


def _events_path(events_dir: str, case_id: str) -> str:
    return os.path.join(events_dir, f"events-{case_id}.jsonl")


class ReplayWriter:
    def __init__(self, events_dir: str):
        self._events_dir = events_dir
        os.makedirs(events_dir, exist_ok=True)

    async def tee(self, event: ActivityEvent, case_id: str = "") -> None:
        """Append ``event`` to ``events-<case>.jsonl`` with a wall-clock ts.

        ``case_id`` defaults to a ``case_id`` key on the event (if the producer
        embeds one) so the method still matches the ``tee(event)`` shape; the
        pipeline passes it explicitly.
        """
        cid = case_id or event.get("case_id", "") or "unknown"  # type: ignore[arg-type]
        record = {**event, "replay_ts": datetime.now(timezone.utc).isoformat()}
        line = json.dumps(record, separators=(",", ":")) + "\n"
        path = _events_path(self._events_dir, cid)
        # Append is the only mutation; fsync isn't needed for the replay fallback.
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line)


async def stream_replay(case_id: str, events_dir: str) -> AsyncIterator[str]:
    """Yield ``"data: {json}\\n\\n"`` SSE frames at the original cadence.

    Re-reads ``events-<case>.jsonl`` and sleeps the wall-clock gap between
    successive ``created_at`` stamps so the replay matches live timing. A missing
    file yields nothing (an empty replay is valid).
    """
    path = _events_path(events_dir, case_id)
    if not os.path.exists(path):
        return
    prev_ts: datetime | None = None
    with open(path, encoding="utf-8") as fh:
        lines = [ln for ln in fh if ln.strip()]
    for line in lines:
        record = json.loads(line)
        ts = _parse_ts(record.get("created_at"))
        if prev_ts is not None and ts is not None:
            gap = (ts - prev_ts).total_seconds()
            if gap > 0:
                await asyncio.sleep(min(gap, 5.0))  # cap so a long live gap never wedges
        prev_ts = ts if ts is not None else prev_ts
        yield f"data: {json.dumps(record, separators=(',', ':'))}\n\n"


def _parse_ts(raw) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except (ValueError, TypeError):
        return None
