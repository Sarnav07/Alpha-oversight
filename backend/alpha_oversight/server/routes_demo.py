"""Demo trigger routes — Beat-A (known pattern) and Beat-B (novel evasion).

Each POST drives the full ``run_surveillance`` choreography on a *fresh* case
room (so repeated demo runs never collide on the CaseStore primary key) over the
app's mock Band spine + seeded registry. Beat-A injects ``clean_layering`` (FLAGs
instantly); Beat-B injects ``novel_layering_evasion`` (PASSes the seed rules ->
ESCALATED, awaiting the human + a Phase-5 codify).
"""

from __future__ import annotations

import asyncio
from uuid import uuid4

from fastapi import APIRouter, Request

from alpha_oversight.agents.adversary import Adversary
from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.generators.scenarios import clean_layering, novel_layering_evasion
from alpha_oversight.orchestration.rnd_loop import run_rnd
from alpha_oversight.orchestration.surveillance_pipeline import (
    ADVERSARY_MODEL_KEY,
    run_surveillance,
)
from alpha_oversight.reused.tool_registry import ToolRegistry

router = APIRouter()


async def _run_beat(request: Request, events) -> dict:
    st = request.app.state
    room = st.surveillance_room          # the (real or mock) Band room both desks share
    case_id = f"case-{uuid4().hex[:8]}"  # unique per run — many cases share one room
    # A bridge bound to that room (events-only Chinese-wall crossing).
    bridge = SanitizedBridge(st.rnd_handoff, surveillance_room=room)
    # Shield the pipeline from request-cancellation: the big open models can make a
    # case run several minutes, longer than some clients wait. If the client
    # disconnects, the case must still finalise (FLAGGED/ESCALATED) in the store —
    # the frontend follows it via SSE + /cases polling, not this response.
    case = await asyncio.shield(run_surveillance(
        events,
        st.handoff,
        st.case_store,
        st.registry,
        st.event_bus,
        st.ledger,
        bridge=bridge,
        replay=st.replay,
        surveillance_room=room,
        case_id=case_id,
    ))
    return {
        "case_id": case.case_id,
        "state": case.state.value,
        "verdict": case.verdict.model_dump() if case.verdict else None,
    }


@router.post("/demo/beat-a")
async def demo_beat_a(request: Request):
    """Inject a known clean layering pattern -> instant FLAGGED."""
    return await _run_beat(request, clean_layering())


@router.post("/demo/beat-b")
async def demo_beat_b(request: Request):
    """Inject the novel 400ms evasion -> PASS -> ESCALATED -> human."""
    return await _run_beat(request, novel_layering_evasion())


@router.post("/demo/rnd")
async def demo_rnd(request: Request):
    """Run the LIVE R&D adversary (not a canned evasion).

    The adversary proposes order-event sequences; two *deterministic* oracles gate
    each one — the rule engine must MISS it (evaded) AND the backtest must show
    profit + price impact (economically real). The first confirmed evasion crosses
    the Chinese wall (events only) and is run through the full surveillance
    choreography. Non-deterministic — see ``/demo/beat-b`` for the canned,
    always-escalates version.
    """
    st = request.app.state
    room = st.surveillance_room
    case_id = f"case-{uuid4().hex[:8]}"
    adversary = Adversary(ADVERSARY_MODEL_KEY, ToolRegistry(), st.event_bus, st.ledger)
    result = await asyncio.shield(run_rnd(
        st.registry,
        st.rnd_handoff,
        K=3,
        surveillance_room=room,
        adversary=adversary,
    ))
    if not result.confirmed:
        return {
            "confirmed": False,
            "rounds": result.rounds,
            "note": "live adversary found no evade-and-profit sequence in K rounds",
        }
    # The confirmed evasion already crossed the wall inside run_rnd; run the
    # choreography on those events (no bridge — don't re-cross).
    case = await asyncio.shield(run_surveillance(
        result.events,
        st.handoff,
        st.case_store,
        st.registry,
        st.event_bus,
        st.ledger,
        replay=st.replay,
        surveillance_room=room,
        case_id=case_id,
    ))
    return {
        "confirmed": True,
        "rounds": result.rounds,
        "params": result.params,
        "case_id": case.case_id,
        "state": case.state.value,
        "verdict": case.verdict.model_dump() if case.verdict else None,
    }
