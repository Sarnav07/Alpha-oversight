"""Demo trigger routes — Beat-A (known pattern) and Beat-B (novel evasion).

Each POST drives the full ``run_surveillance`` choreography on a *fresh* case
room (so repeated demo runs never collide on the CaseStore primary key) over the
app's mock Band spine + seeded registry. Beat-A injects ``clean_layering`` (FLAGs
instantly); Beat-B injects ``novel_layering_evasion`` (PASSes the seed rules ->
ESCALATED, awaiting the human + a Phase-5 codify).
"""

from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Request

from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.generators.scenarios import clean_layering, novel_layering_evasion
from alpha_oversight.orchestration.surveillance_pipeline import run_surveillance

router = APIRouter()


async def _run_beat(request: Request, events) -> dict:
    st = request.app.state
    room = f"case-{uuid4().hex[:8]}"
    # A per-run bridge bound to this case room (events-only Chinese-wall crossing).
    bridge = SanitizedBridge(st.rnd_handoff, surveillance_room=room)
    case = await run_surveillance(
        events,
        st.handoff,
        st.case_store,
        st.registry,
        st.event_bus,
        st.ledger,
        bridge=bridge,
        replay=st.replay,
        surveillance_room=room,
    )
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
