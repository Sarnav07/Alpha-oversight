"""HITL routes — human confirm / reject (the state-machine half of the loop).

Phase 4 wires the bounded state transition only: confirm -> FLAGGED, reject ->
CLOSED, both gated through ``next_state`` so an illegal transition (e.g. a case
not in ESCALATED) is rejected rather than silently applied. The live rule
codification + regression gate the confirm path eventually triggers is Phase 5
(``rules/codify``); this route deliberately stops at the transition.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from alpha_oversight.state.state_machine import next_state

router = APIRouter()


async def _transition(request: Request, case_id: str, trigger: str):
    store = request.app.state.case_store
    case = await store.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"unknown case {case_id}")
    try:
        target = next_state(case.state, trigger)
    except ValueError as err:
        raise HTTPException(status_code=409, detail=str(err)) from err
    updated = await store.transition(case_id, target)
    return updated.model_dump(mode="json")


@router.post("/cases/{case_id}/confirm")
async def confirm_case(case_id: str, request: Request):
    """Human confirms manipulation -> ESCALATED -> FLAGGED (codify is Phase 5)."""
    return await _transition(request, case_id, "confirm")


@router.post("/cases/{case_id}/reject")
async def reject_case(case_id: str, request: Request):
    """Human dismisses -> CLOSED(dismissed)."""
    return await _transition(request, case_id, "reject")
