"""HITL routes — human confirm / reject (the co-evolution loop closes here).

``POST /cases/{id}/confirm`` on an ESCALATED case runs the live codify path
(design §2.3 / §5.7 — the demo's wow moment):

    derive_rule(case, resolved_inputs, "compliance")  ->  registry.codify(rule)
      ->  regression_gate(rule, evasion_events, resolved_inputs)  (assert True)
      ->  ESCALATED -> FLAGGED  ->  emit a ``rule_codified`` Band event + ledger.append

The new rule + the regression gate run over the order events + the debate-resolved
inputs the pipeline persisted on the case at escalation. The ``rule_codified``
Band message rides the surveillance ``BandHandoff`` so its hash is bound into the
audit chain (the ledger leaf carries ``kind="rule_codified"``).

``POST /cases/{id}/reject`` dismisses the case (ESCALATED -> CLOSED) and codifies
nothing. Both transitions are gated through ``next_state`` so an illegal trigger
(e.g. confirm on a non-ESCALATED case) is a 409, never silently applied. No LLMs
here — codify + the gate are pure deterministic math over the rule engine.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from alpha_oversight.contracts.band_envelope import BandKind, Envelope
from alpha_oversight.contracts.case_contracts import ResolvedInputs
from alpha_oversight.rules import codify
from alpha_oversight.state.state_machine import next_state

router = APIRouter()

_CONFIRMED_BY = "compliance"


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
    return case, updated


@router.post("/cases/{case_id}/confirm")
async def confirm_case(case_id: str, request: Request):
    """Human confirms manipulation -> derive + gate + codify a rule -> FLAGGED.

    The case must be ESCALATED (``next_state`` enforces this, else 409). The
    derived rule is regression-gated against the persisted evasion before it is
    persisted; a gate failure is a 422 (we never codify a rule that doesn't close
    the gap).
    """
    st = request.app.state
    store = st.case_store
    case = await store.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"unknown case {case_id}")
    # Gate the transition first so a non-ESCALATED case 409s before any codify.
    try:
        target = next_state(case.state, "confirm")
    except ValueError as err:
        raise HTTPException(status_code=409, detail=str(err)) from err

    resolved = case.resolved_inputs or ResolvedInputs()

    # 1) derive a new parameterized rule from the case + the debate-resolved inputs.
    new_rule = codify.derive_rule(case, resolved, _CONFIRMED_BY)
    # 2) regression-gate it: the persisted evasion must FLAG under the new rule.
    passed = codify.regression_gate(new_rule, case.events, resolved)
    if not passed:
        raise HTTPException(
            status_code=422,
            detail=f"regression gate failed for derived rule {new_rule.id}",
        )
    # 3) codify it live (Active Rules N -> N+1) and flip ESCALATED -> FLAGGED.
    st.registry.codify(new_rule)
    updated = await store.transition(case_id, target)

    # 4) emit a rule_codified Band event + ledger leaf (binds the codify into the
    #    audit chain as a Band message hash).
    env = Envelope(
        case_id=case_id,
        from_="escalation",
        to="rnd",
        kind=BandKind.RULE_CODIFIED,
        payload={
            "rule": {
                "id": new_rule.id,
                "family": new_rule.family.value,
                "params": new_rule.params,
                "provenance": new_rule.provenance,
                "status": new_rule.status,
            },
            "regression_passed": True,
            "confirmed_by": _CONFIRMED_BY,
        },
    )
    await st.handoff.send(case.room_id, env, peer="rnd")

    return {
        "case": updated.model_dump(mode="json"),
        "codified": True,
        "regression_passed": True,
        "rule": {
            "id": new_rule.id,
            "family": new_rule.family.value,
            "params": new_rule.params,
            "provenance": new_rule.provenance,
            "status": new_rule.status,
        },
    }


@router.post("/cases/{case_id}/reject")
async def reject_case(case_id: str, request: Request):
    """Human dismisses -> CLOSED(dismissed); no rule is codified."""
    _case, updated = await _transition(request, case_id, "reject")
    return {"case": updated.model_dump(mode="json"), "codified": False}
