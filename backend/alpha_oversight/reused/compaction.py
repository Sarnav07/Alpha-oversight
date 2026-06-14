# LIFTED FROM prediction-arena/backend/src/core/agent/loop.py:22-81 — verbatim (consts + wrap-up nudge + compaction).
"""Turn-aware in-context compaction (memory layer L1).

Replaces large, stale tool results with a truncated preview so the agent's
message history stays bounded across many ReAct turns.
"""

_WRAP_UP_THRESHOLD = 10
_COMPACT_AGE_TURNS = 8
_COMPACT_SIZE_BYTES = 2000
_COMPACT_PREVIEW_CHARS = 200
_COMPACT_PREFIX = "[Compacted]"


def _wrap_up_nudge(remaining: int) -> dict[str, object]:
    return {
        "role": "user",
        "content": (
            f"You have {remaining} turns remaining in this session. "
            "Start wrapping up — finalize any pending work, "
            "update your scratchpad with current findings and notes, "
            "and write your journal entry. Don't start new research."
        ),
    }


def _compact_old_tool_results(
    messages: list[dict[str, object]], current_turn: int
) -> None:
    """Replace large, stale tool results with a truncated preview.

    Mutates *messages* in place.  Only touches ``role: "tool"`` entries
    that are older than ``_COMPACT_AGE_TURNS`` turns and whose content
    exceeds ``_COMPACT_SIZE_BYTES``.
    """
    # First pass: assign a turn number to every message.
    # Each assistant message with tool_calls increments the turn counter;
    # the tool results that follow belong to that turn.
    turn_map: dict[int, int] = {}  # message index -> turn number
    turn = 0
    for idx, msg in enumerate(messages):
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            turn += 1
        turn_map[idx] = turn

    # Second pass: compact old, large tool results.
    for idx, msg in enumerate(messages):
        if msg.get("role") != "tool":
            continue
        content = msg.get("content")
        if not isinstance(content, str):
            continue
        if content.startswith(_COMPACT_PREFIX):
            continue
        age = current_turn - turn_map.get(idx, current_turn)
        if age < _COMPACT_AGE_TURNS:
            continue
        if len(content) < _COMPACT_SIZE_BYTES:
            continue

        tool_name = msg.get("name", "tool")
        preview = content[:_COMPACT_PREVIEW_CHARS]
        msg["content"] = (
            f"{_COMPACT_PREFIX} {tool_name} returned {len(content)} bytes, "
            f"{age} turns ago. Preview:\n{preview}"
        )
