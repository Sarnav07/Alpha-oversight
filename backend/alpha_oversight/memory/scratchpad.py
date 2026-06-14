"""ScratchpadJournal — per-case agent memory (layer L2), aiosqlite-backed.

One row per ``case_id`` holding a rolling *scratchpad* (overwrite-on-write) and
an append-only *journal* (newline-joined entries) that can be compacted. L1 =
reused/compaction (in-context tool-result trimming), L3 = audit/ledger.

The journal lives in a single TEXT column so "one row per case_id" is literal;
``get_recent_journal`` is a whole-entry sliding window bounded by ``max_chars``,
and ``compact_journal`` collapses the older entries into a marker while keeping
the most recent ones verbatim (recency-preserving).

``__init__`` is synchronous (per the locked signature), so the schema + the
case row are materialized lazily on the first async call.
"""

from __future__ import annotations

import aiosqlite

# Separator between journal entries inside the single TEXT column.
_SEP = "\n"
# Most-recent entries kept verbatim when compacting; the rest collapse.
_COMPACT_KEEP = 5

_SCHEMA = """
CREATE TABLE IF NOT EXISTS scratchpad_journal (
    case_id     TEXT PRIMARY KEY,
    model_key   TEXT NOT NULL DEFAULT '',
    scratchpad  TEXT NOT NULL DEFAULT '',
    journal     TEXT NOT NULL DEFAULT ''
)
"""


class ScratchpadJournal:
    def __init__(self, db_path: str, case_id: str, model_key: str):
        self._db_path = db_path
        self._case_id = case_id
        self._model_key = model_key
        self._ready = False

    async def _ensure(self) -> None:
        """Create the table + this case's row once (lazy, idempotent)."""
        if self._ready:
            return
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(_SCHEMA)
            await db.execute(
                "INSERT OR IGNORE INTO scratchpad_journal "
                "(case_id, model_key) VALUES (?, ?)",
                (self._case_id, self._model_key),
            )
            await db.commit()
        self._ready = True

    async def update_scratchpad(self, content: str) -> str:
        """Overwrite the scratchpad with *content*; return what was stored."""
        await self._ensure()
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "UPDATE scratchpad_journal SET scratchpad = ? WHERE case_id = ?",
                (content, self._case_id),
            )
            await db.commit()
        return content

    async def read_scratchpad(self) -> str:
        """Return the current scratchpad (empty string if never written)."""
        await self._ensure()
        return await self._get_col("scratchpad")

    async def append_journal(self, entry: str) -> str:
        """Append *entry* to the journal; return the full journal text."""
        await self._ensure()
        async with aiosqlite.connect(self._db_path) as db:
            cur = await db.execute(
                "SELECT journal FROM scratchpad_journal WHERE case_id = ?",
                (self._case_id,),
            )
            row = await cur.fetchone()
            existing = row[0] if row and row[0] else ""
            new = f"{existing}{_SEP}{entry}" if existing else entry
            await db.execute(
                "UPDATE scratchpad_journal SET journal = ? WHERE case_id = ?",
                (new, self._case_id),
            )
            await db.commit()
        return new

    async def get_recent_journal(self, max_chars: int = 8000) -> str:
        """Most-recent journal entries whose joined length fits *max_chars*.

        Whole entries only (never split mid-entry); returned oldest→newest so
        the prompt reads chronologically.
        """
        await self._ensure()
        journal = await self._get_col("journal")
        if not journal:
            return ""
        entries = journal.split(_SEP)
        kept: list[str] = []
        total = 0
        for entry in reversed(entries):
            add = len(entry) + (len(_SEP) if kept else 0)
            if total + add > max_chars:
                break
            kept.append(entry)
            total += add
        kept.reverse()
        return _SEP.join(kept)

    async def compact_journal(self) -> str:
        """Collapse older entries into a marker, keep the last few verbatim.

        Shrinks the stored journal while preserving recent signal. Returns the
        new (compacted) journal body.
        """
        await self._ensure()
        journal = await self._get_col("journal")
        entries = journal.split(_SEP) if journal else []
        if len(entries) <= _COMPACT_KEEP:
            return journal
        dropped = len(entries) - _COMPACT_KEEP
        marker = f"[Compacted {dropped} earlier journal entries]"
        compacted = _SEP.join([marker, *entries[-_COMPACT_KEEP:]])
        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "UPDATE scratchpad_journal SET journal = ? WHERE case_id = ?",
                (compacted, self._case_id),
            )
            await db.commit()
        return compacted

    async def _get_col(self, col: str) -> str:
        async with aiosqlite.connect(self._db_path) as db:
            cur = await db.execute(
                f"SELECT {col} FROM scratchpad_journal WHERE case_id = ?",
                (self._case_id,),
            )
            row = await cur.fetchone()
        return row[0] if row and row[0] else ""
