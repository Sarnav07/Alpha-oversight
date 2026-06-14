"""Named-section prompt assembly (memory injection into the user prompt)."""

from __future__ import annotations


def build_sections(scratchpad: str, journal: str, case_brief: str) -> str:
    """Compose named sections (scratchpad / journal / case brief) into one user prompt."""
    raise NotImplementedError
