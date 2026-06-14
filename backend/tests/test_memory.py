"""Phase 3B — memory layer tests.

L2 = ScratchpadJournal (per-case sqlite scratchpad + journal); injection =
build_sections. L1 (reused/compaction) is asserted importable. All in-process;
no LLM, no network.
"""

from __future__ import annotations

import pytest

from alpha_oversight.memory.prompt_sections import build_sections
from alpha_oversight.memory.scratchpad import ScratchpadJournal


def test_compaction_l1_importable() -> None:
    """L1 in-context compaction is reused as-is and importable."""
    from alpha_oversight.reused import compaction

    assert hasattr(compaction, "_compact_old_tool_results")
    assert compaction._COMPACT_AGE_TURNS == 8
    assert compaction._COMPACT_SIZE_BYTES == 2000


@pytest.mark.asyncio
async def test_scratchpad_overwrite(memory_db: str) -> None:
    """update_scratchpad overwrites; the latest content is what reads back."""
    j = ScratchpadJournal(memory_db, case_id="case-1", model_key="m")

    first = await j.update_scratchpad("first findings")
    assert first == "first findings"
    assert await j.read_scratchpad() == "first findings"

    second = await j.update_scratchpad("second findings, supersedes")
    assert second == "second findings, supersedes"
    # Overwrite, not append.
    assert await j.read_scratchpad() == "second findings, supersedes"


@pytest.mark.asyncio
async def test_scratchpad_isolated_per_case(memory_db: str) -> None:
    """One row per case_id: writing case-1 does not touch case-2."""
    j1 = ScratchpadJournal(memory_db, case_id="case-1", model_key="m")
    j2 = ScratchpadJournal(memory_db, case_id="case-2", model_key="m")

    await j1.update_scratchpad("alpha")
    await j2.update_scratchpad("bravo")

    assert await j1.read_scratchpad() == "alpha"
    assert await j2.read_scratchpad() == "bravo"


@pytest.mark.asyncio
async def test_journal_append_and_recent_window_respects_max_chars(
    memory_db: str,
) -> None:
    """append_journal accumulates; get_recent_journal is a sliding window
    bounded by max_chars (keeps the most recent entries)."""
    j = ScratchpadJournal(memory_db, case_id="case-1", model_key="m")

    for i in range(20):
        await j.append_journal(f"entry-{i:02d} " + "x" * 40)

    full = await j.get_recent_journal(max_chars=10_000)
    # All 20 entries fit in a generous window.
    assert "entry-00" in full
    assert "entry-19" in full

    windowed = await j.get_recent_journal(max_chars=200)
    assert len(windowed) <= 200
    # Sliding window keeps the most recent, drops the oldest.
    assert "entry-19" in windowed
    assert "entry-00" not in windowed


@pytest.mark.asyncio
async def test_get_recent_journal_empty(memory_db: str) -> None:
    """No entries yet → empty string, not an error."""
    j = ScratchpadJournal(memory_db, case_id="fresh", model_key="m")
    assert await j.get_recent_journal() == ""


@pytest.mark.asyncio
async def test_compact_journal_shrinks(memory_db: str) -> None:
    """compact_journal collapses the journal so its stored size drops."""
    j = ScratchpadJournal(memory_db, case_id="case-1", model_key="m")

    for i in range(30):
        await j.append_journal(f"entry-{i:02d} " + "y" * 60)

    before = await j.get_recent_journal(max_chars=1_000_000)
    summary = await j.compact_journal()
    after = await j.get_recent_journal(max_chars=1_000_000)

    assert isinstance(summary, str)
    assert len(after) < len(before)
    # Compaction returns the new (compacted) journal body.
    assert after == summary


@pytest.mark.asyncio
async def test_compact_journal_preserves_recent_signal(memory_db: str) -> None:
    """Compaction keeps the most-recent entry visible (recency-preserving)."""
    j = ScratchpadJournal(memory_db, case_id="case-1", model_key="m")
    for i in range(30):
        await j.append_journal(f"entry-{i:02d}")

    after = await j.compact_journal()
    assert "entry-29" in after


def test_build_sections_includes_all_three() -> None:
    """build_sections renders all three named sections into one prompt block."""
    out = build_sections(
        scratchpad="SCRATCH_CONTENT",
        journal="JOURNAL_CONTENT",
        case_brief="BRIEF_CONTENT",
    )
    assert isinstance(out, str)
    # Each payload is present.
    assert "SCRATCH_CONTENT" in out
    assert "JOURNAL_CONTENT" in out
    assert "BRIEF_CONTENT" in out
    # Sections are named/labelled (case-insensitive check on the headers).
    low = out.lower()
    assert "scratchpad" in low
    assert "journal" in low
    assert "brief" in low


def test_build_sections_handles_empty() -> None:
    """Empty inputs still yield a string with all three section headers."""
    out = build_sections(scratchpad="", journal="", case_brief="")
    low = out.lower()
    assert "scratchpad" in low
    assert "journal" in low
    assert "brief" in low
