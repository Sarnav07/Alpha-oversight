"""ScratchpadJournal — per-case agent memory (layer L2), aiosqlite-backed.

One row per case_id holding a rolling scratchpad + an append-only journal that
can be compacted. L1 = reused/compaction (in-context), L3 = audit/ledger.
"""

from __future__ import annotations


class ScratchpadJournal:
    def __init__(self, db_path: str, case_id: str, model_key: str):
        self._db_path = db_path
        self._case_id = case_id
        self._model_key = model_key
        raise NotImplementedError

    async def update_scratchpad(self, content: str) -> str:
        raise NotImplementedError

    async def append_journal(self, entry: str) -> str:
        raise NotImplementedError

    async def get_recent_journal(self, max_chars: int = 8000) -> str:
        raise NotImplementedError

    async def compact_journal(self) -> str:
        raise NotImplementedError
