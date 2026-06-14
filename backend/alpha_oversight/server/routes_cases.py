"""Case + rule + stats read routes (thin; read ``app.state``).

All read-only: the viewer polls these for the case list, a single case + its
audit lineage, the live rule registry, and the persistent stats bar. The audit
route returns the case's ledger rows AND ``verify_chain`` over the produced
JSONL, so a judge can see the chain verify in the UI.
"""

from __future__ import annotations

import json
import os

from fastapi import APIRouter, HTTPException, Request

from alpha_oversight.audit.ledger import Ledger

router = APIRouter()


@router.get("/cases")
async def list_cases(request: Request):
    cases = await request.app.state.case_store.list()
    return [c.model_dump(mode="json") for c in cases]


@router.get("/cases/{case_id}")
async def get_case(case_id: str, request: Request):
    case = await request.app.state.case_store.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"unknown case {case_id}")
    return case.model_dump(mode="json")


@router.get("/cases/{case_id}/audit")
async def get_case_audit(case_id: str, request: Request):
    """Return this case's ledger rows + a fresh ``verify_chain`` over the JSONL."""
    settings = request.app.state.settings
    jsonl_path = f"{settings.ledger_dir}/ledger.jsonl"
    rows: list[dict] = []
    if os.path.exists(jsonl_path):
        with open(jsonl_path, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                rec = json.loads(line)
                if rec.get("case_id") == case_id:
                    rows.append(rec)
    return {
        "case_id": case_id,
        "entries": rows,
        "verified": Ledger.verify_chain(jsonl_path),
    }


@router.get("/rules")
async def list_rules(request: Request):
    rules = request.app.state.registry.active()
    return [
        {
            "id": r.id,
            "family": r.family.value,
            "params": r.params,
            "provenance": r.provenance,
            "status": r.status,
        }
        for r in rules
    ]


@router.get("/stats")
async def get_stats(request: Request):
    """Business-value stats bar: case counts by state + active-rule count."""
    cases = await request.app.state.case_store.list()
    by_state: dict[str, int] = {}
    for c in cases:
        by_state[c.state.value] = by_state.get(c.state.value, 0) + 1
    return {
        "total_cases": len(cases),
        "by_state": by_state,
        "flagged": by_state.get("FLAGGED", 0),
        "escalated": by_state.get("ESCALATED", 0),
        "active_rules": request.app.state.registry.count(),
    }
