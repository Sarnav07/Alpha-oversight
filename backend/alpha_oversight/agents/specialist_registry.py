"""Capability registry — specialist handle + order-flow-feature trigger.

Band peers carry no capability metadata, so selection is an external table:
the Investigator computes ``Features`` then picks the first specialist whose
trigger fires. Selection depends on the order flow, so it can't collapse into
one fixed prompt.
"""

from __future__ import annotations

from alpha_oversight.contracts.case_contracts import Features

SPECIALISTS: dict[str, dict] = {
    "spoofing":   {"handle": "@spoof-spec", "trigger": lambda f: f.cancel_to_fill > 0.7},
    "layering":   {"handle": "@layer-spec", "trigger": lambda f: f.depth_levels >= 3},
    "wash_trade": {"handle": "@wash-spec",  "trigger": lambda f: f.self_match_ratio > 0.5},
    "marking":    {"handle": "@mark-spec",  "trigger": lambda f: f.eod_print_spike},
}


def select_specialist(features: Features) -> tuple[str, str]:
    """Return ``(family, handle)`` for the first matching trigger.

    Iterates ``SPECIALISTS`` in insertion order (spoofing -> layering ->
    wash_trade -> marking) and returns the first family whose ``trigger``
    fires on ``features``. Raises ``ValueError`` if none match — the
    Investigator must always recruit *some* specialist, so a no-match means the
    window should not have been opened as a case.
    """
    for family, spec in SPECIALISTS.items():
        if spec["trigger"](features):
            return family, spec["handle"]
    raise ValueError(
        "No specialist trigger fired for features: "
        f"cancel_to_fill={features.cancel_to_fill}, "
        f"depth_levels={features.depth_levels}, "
        f"self_match_ratio={features.self_match_ratio}, "
        f"eod_print_spike={features.eod_print_spike}"
    )
