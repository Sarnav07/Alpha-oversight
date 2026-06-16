"""Deterministic order-flow feature extraction.

The four ``Features`` that drive specialist selection (and that the
AnomalyDetector reports) are COMPUTED from the events here — never hallucinated
by an LLM. We reuse the per-family rule math so the triage features and the
authoritative verdict read the same numbers off the same flow.

``compute_features`` runs each family metric with default params and projects the
relevant scalar into the ``Features`` shape. ``is_abnormal`` is a deterministic
triage floor (mirrors the specialist triggers) used as a safety net so a weak
triage model can't suppress a clearly abnormal window.
"""

from __future__ import annotations

from alpha_oversight.contracts.case_contracts import Features
from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.rules import (
    math_layering,
    math_marking,
    math_spoofing,
    math_wash_trade,
)


def compute_features(events: list[OrderEvent]) -> Features:
    """Derive the four triage features deterministically from the order flow."""
    _, spoof = math_spoofing.metric(events, {})
    _, layer = math_layering.metric(events, {})
    _, wash = math_wash_trade.metric(events, {})
    mark_tripped, _mark = math_marking.metric(events, {})
    # The spoofing signal is cancels NEAR opposite-side fills (not raw
    # cancel/placed) — a pure layering ladder cancels everything but has no fills,
    # so near_fill_cancel_ratio≈0 and it won't pre-empt the layering trigger.
    return Features(
        cancel_to_fill=float(spoof.get("near_fill_cancel_ratio", 0.0)),
        depth_levels=int(layer.get("depth_levels", 0)),
        self_match_ratio=float(wash.get("self_match_ratio", 0.0)),
        eod_print_spike=bool(mark_tripped),
    )


def is_abnormal(features: Features) -> bool:
    """Deterministic triage floor — True if any feature is clearly abnormal.

    Mirrors the ``select_specialist`` family triggers so the floor agrees with
    the recruit path (layering depth >= 3, spoofing cancel ratio > 0.7, wash
    self-match > 0.5, or an end-of-day marking spike).
    """
    return (
        features.depth_levels >= 3
        or features.cancel_to_fill > 0.7
        or features.self_match_ratio > 0.5
        or features.eod_print_spike
    )
