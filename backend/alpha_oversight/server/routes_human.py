"""HITL routes — human confirm / reject (drives codify + regression gate)."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.post("/cases/{case_id}/confirm")
async def confirm_case(case_id: str):
    """Human confirms manipulation -> codify a new rule -> regression gate -> FLAGGED."""
    raise NotImplementedError


@router.post("/cases/{case_id}/reject")
async def reject_case(case_id: str):
    """Human dismisses -> CLOSED(dismissed)."""
    raise NotImplementedError
