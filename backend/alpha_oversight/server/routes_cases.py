"""Case + rule + stats read routes."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/cases")
async def list_cases():
    raise NotImplementedError


@router.get("/cases/{case_id}")
async def get_case(case_id: str):
    raise NotImplementedError


@router.get("/cases/{case_id}/audit")
async def get_case_audit(case_id: str):
    raise NotImplementedError


@router.get("/rules")
async def list_rules():
    raise NotImplementedError


@router.get("/stats")
async def get_stats():
    raise NotImplementedError
