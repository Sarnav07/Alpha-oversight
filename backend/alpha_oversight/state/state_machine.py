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


def next_state(current: CaseState, trigger: str) -> CaseState:
    """Return the next state for ``trigger``; raise on illegal. ``"timeout"`` -> CLOSED."""
    raise NotImplementedError
