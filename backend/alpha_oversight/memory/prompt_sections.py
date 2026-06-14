"""Named-section prompt assembly (memory injection into the user prompt).

Renders the three memory inputs an agent carries between turns — the rolling
``scratchpad`` (L2), the ``journal`` recent window (L2), and the static
``case_brief`` — as labelled sections in one prompt block. Empty inputs still
emit their header (so the agent sees a consistent layout).
"""

from __future__ import annotations


def build_sections(scratchpad: str, journal: str, case_brief: str) -> str:
    """Compose named sections (case brief / scratchpad / journal) into one
    user prompt block."""
    return "\n\n".join(
        [
            _section("CASE BRIEF", case_brief),
            _section("SCRATCHPAD", scratchpad),
            _section("JOURNAL", journal),
        ]
    )


def _section(title: str, body: str) -> str:
    content = body.strip() if body and body.strip() else "(empty)"
    return f"## {title}\n{content}"
