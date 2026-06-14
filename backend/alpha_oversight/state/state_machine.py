"""Case state machine — bounded transitions so the demo cannot wedge.

``next_state`` raises on an illegal transition; every state has a TIMEOUT that
falls back to CLOSED. ``Case`` is the persisted record (case_id == Band room
task_id).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel

from alpha_oversight.contracts.rule_contracts import Verdict


class CaseState(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    FLAGGED = "FLAGGED"
    ESCALATED = "ESCALATED"
    CLOSED = "CLOSED"


class Case(BaseModel):
    case_id: str
    room_id: str
    state: CaseState
    features: dict = {}
    verdict: Verdict | None = None
    created_at: datetime
    updated_at: datetime


# Per-state timeout (seconds). A bounded safety valve — "timeout" -> CLOSED.
TIMEOUTS: dict[CaseState, float] = {
    CaseState.OPEN: 30.0,
    CaseState.UNDER_REVIEW: 60.0,
    CaseState.FLAGGED: 30.0,
    CaseState.ESCALATED: 120.0,
    CaseState.CLOSED: 0.0,
}


# Authoritative transition table (design §2.3). (state, trigger) -> next state.
# The "timeout" safety valve is added below for every non-terminal state so the
# table stays the single source of truth and a missing timeout can't slip in.
_TRANSITIONS: dict[tuple[CaseState, str], CaseState] = {
    (CaseState.OPEN, "suspicious"): CaseState.UNDER_REVIEW,
    (CaseState.UNDER_REVIEW, "flag"): CaseState.FLAGGED,        # Beat A: known pattern
    (CaseState.UNDER_REVIEW, "escalate"): CaseState.ESCALATED,  # Beat B: rules miss
    (CaseState.FLAGGED, "close"): CaseState.CLOSED,
    (CaseState.ESCALATED, "confirm"): CaseState.FLAGGED,        # human-confirm -> codify
    (CaseState.ESCALATED, "reject"): CaseState.CLOSED,          # human dismiss
}

# CLOSED is terminal: it has no timeout and no outgoing edge.
for _state, _budget in TIMEOUTS.items():
    if _budget > 0.0:
        _TRANSITIONS[(_state, "timeout")] = CaseState.CLOSED


def next_state(current: CaseState, trigger: str) -> CaseState:
    """Return the next state for ``trigger``; raise on illegal. ``"timeout"`` -> CLOSED.

    The transition table is exhaustive: any ``(current, trigger)`` not in it is a
    coding bug, so we raise ``ValueError`` rather than silently no-op. ``timeout``
    is legal from every non-terminal state and always lands in CLOSED.
    """
    try:
        return _TRANSITIONS[(current, trigger)]
    except KeyError:
        raise ValueError(
            f"illegal transition: {current.value} --({trigger})-->"
        ) from None
