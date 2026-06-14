"""Phase 3C — specialist_registry unit tests (no LLMs, pure feature routing).

``select_specialist(features)`` returns ``(family, handle)`` for the FIRST
trigger that fires, in ``SPECIALISTS`` insertion order
(spoofing -> layering -> wash_trade -> marking). Selection is driven entirely
by order-flow ``Features``, so the agent set is data-dependent (design §6.4).

Covers (>= 4 feature vectors route to the correct handle + trigger order):
- spoofing  : cancel_to_fill > 0.7
- layering  : depth_levels >= 3   (and cancel_to_fill below the spoof trigger)
- wash_trade: self_match_ratio > 0.5 (other triggers silent)
- marking   : eod_print_spike True (last resort)
- trigger ORDER: spoofing wins over layering when BOTH would fire.
- the returned handle matches the SPECIALISTS table.
"""

from __future__ import annotations

import pytest

from alpha_oversight.agents.specialist_registry import (
    SPECIALISTS,
    select_specialist,
)
from alpha_oversight.contracts.case_contracts import Features


def test_spoofing_routes_to_spoof_spec() -> None:
    f = Features(cancel_to_fill=0.85, depth_levels=0, self_match_ratio=0.0)
    family, handle = select_specialist(f)
    assert family == "spoofing"
    assert handle == "@spoof-spec"
    assert handle == SPECIALISTS["spoofing"]["handle"]


def test_layering_routes_to_layer_spec() -> None:
    # cancel_to_fill below the spoof trigger so layering is the first to fire.
    f = Features(cancel_to_fill=0.2, depth_levels=4, self_match_ratio=0.0)
    family, handle = select_specialist(f)
    assert family == "layering"
    assert handle == "@layer-spec"


def test_wash_trade_routes_to_wash_spec() -> None:
    f = Features(cancel_to_fill=0.1, depth_levels=1, self_match_ratio=0.8)
    family, handle = select_specialist(f)
    assert family == "wash_trade"
    assert handle == "@wash-spec"


def test_marking_routes_to_mark_spec() -> None:
    # Only the EOD-print-spike flag is set; every other trigger is silent.
    f = Features(
        cancel_to_fill=0.0,
        depth_levels=0,
        self_match_ratio=0.0,
        eod_print_spike=True,
    )
    family, handle = select_specialist(f)
    assert family == "marking"
    assert handle == "@mark-spec"


def test_trigger_order_spoofing_beats_layering() -> None:
    # Both spoofing (cancel_to_fill>0.7) and layering (depth_levels>=3) fire;
    # spoofing is earlier in the SPECIALISTS table, so it must win.
    f = Features(cancel_to_fill=0.9, depth_levels=5, self_match_ratio=0.0)
    family, handle = select_specialist(f)
    assert family == "spoofing"
    assert handle == "@spoof-spec"


def test_no_trigger_raises() -> None:
    # No feature crosses any threshold -> no specialist can be recruited.
    f = Features(cancel_to_fill=0.0, depth_levels=0, self_match_ratio=0.0)
    with pytest.raises((ValueError, LookupError)):
        select_specialist(f)
