"""Labeled order-event scenario generators (Phase-1A).

Beat-A clean patterns FLAG against the seed rules; the Beat-B novel evasion
PASSes them (a timing variant). These double as the rule engine's label source.
"""

from __future__ import annotations

from alpha_oversight.contracts.order_events import OrderEvent


def clean_layering() -> list[OrderEvent]:
    """Beat-A known layering pattern (FLAGs)."""
    raise NotImplementedError


def clean_spoofing() -> list[OrderEvent]:
    """Beat-A known spoofing pattern (FLAGs)."""
    raise NotImplementedError


def clean_wash() -> list[OrderEvent]:
    """Beat-A known wash-trade pattern (FLAGs)."""
    raise NotImplementedError


def novel_layering_evasion() -> list[OrderEvent]:
    """Beat-B: a ~400ms variant that PASSes the seed rules."""
    raise NotImplementedError
