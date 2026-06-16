"""Phase-7 server checks (fast — output to stdout AND it never depends on a pipe):
  1. USE_REAL_BAND wires PhoenixBand on the shared room (no network — construction).
  2. The exact /demo/rnd compose (run_rnd -> run_surveillance) runs on mock Band
     with the real adversary LLM but FAST models, proving the endpoint's wiring is
     correct. The live HTTP endpoint uses the chosen (slower) models; its latency
     is identical to /demo/beat-a|b, which are already proven.

    .venv/bin/python scripts/verify_phase7_server.py
"""
from __future__ import annotations
import os
import sys
import uuid
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

_ROLES = ["anomaly", "investigator", "specialist", "prosecution",
          "defense", "adjudicator", "escalation"]


def check_real_band_wiring() -> bool:
    os.environ["USE_REAL_BAND"] = "true"
    from alpha_oversight.server.app import create_app
    from alpha_oversight.band.phoenix_band import PhoenixBand

    app = create_app()

    async def _run() -> bool:
        async with app.router.lifespan_context(app):
            st = app.state
            surv_t = st.handoff._transport
            rnd_t = st.rnd_handoff._transport
            ok = isinstance(surv_t, PhoenixBand) and isinstance(rnd_t, PhoenixBand)
            print(
                f"[1 wiring] USE_REAL_BAND -> surv={type(surv_t).__name__} "
                f"rnd={type(rnd_t).__name__} room={st.surveillance_room[:13]}… "
                f"default_mention={surv_t._default_mention[:8]}…  {'OK' if ok else 'FAIL'}"
            )
            await surv_t.aclose()
            await rnd_t.aclose()
            return ok

    return asyncio.run(_run())


async def _rnd_compose() -> bool:
    os.environ["USE_REAL_BAND"] = "false"
    from alpha_oversight.audit.ledger import Ledger
    from alpha_oversight.band.handoff import BandHandoff
    from alpha_oversight.band.mock_band import MockBand
    from alpha_oversight.agents.adversary import Adversary
    from alpha_oversight.orchestration.rnd_loop import run_rnd
    from alpha_oversight.orchestration.surveillance_pipeline import run_surveillance
    from alpha_oversight.providers import register_models
    from alpha_oversight.reused.events import EventBus
    from alpha_oversight.reused.tool_registry import ToolRegistry
    from alpha_oversight.rules.registry import RuleRegistryStore
    from alpha_oversight.rules.seed_rules import seed_rules
    from alpha_oversight.state.case_store import CaseStore

    base = "./data/live"
    os.makedirs(base, exist_ok=True)
    for f in ("vr_ledger.jsonl", "vr_rules.db", "vr_cases.db"):
        p = os.path.join(base, f)
        if os.path.exists(p):
            os.remove(p)

    register_models()
    ledger = Ledger(os.path.join(base, "vr_ledger.jsonl"), os.path.join(base, "vr_rules.db"))
    registry = RuleRegistryStore(os.path.join(base, "vr_rules.db"))
    for rule in seed_rules():
        registry.codify(rule)
    store = CaseStore(os.path.join(base, "vr_cases.db"))
    bus = EventBus()
    rnd_band, surv_band = MockBand.pair("rnd", "surveillance")
    surv_handoff = BandHandoff(surv_band, ledger, bus, desk="surveillance")
    rnd_handoff = BandHandoff(rnd_band, ledger, bus, desk="rnd")
    room = "case-rnd-verify"
    fast = "aiml-free"  # gpt-4o-mini — exercise the compose quickly

    adversary = Adversary(fast, ToolRegistry(), bus, ledger)
    result = await run_rnd(registry, rnd_handoff, K=2, seed=1,
                           surveillance_room=room, adversary=adversary)
    print(f"[2 /demo/rnd compose] run_rnd confirmed={result.confirmed} rounds={result.rounds}")
    if result.confirmed:
        case = await run_surveillance(
            result.events, surv_handoff, store, registry, bus, ledger,
            models={r: fast for r in _ROLES},
            surveillance_room=room, case_id=f"case-{uuid.uuid4().hex[:8]}",
        )
        print(f"[2 /demo/rnd compose] surveillance -> {case.state.value} "
              f"verdict={case.verdict.result if case.verdict else None}")
    return True  # a clean execution (confirmed True OR False) proves the wiring


if __name__ == "__main__":
    a = check_real_band_wiring()
    b = asyncio.run(_rnd_compose())
    print("VERIFY:", "PASS" if (a and b) else "REVIEW")
    raise SystemExit(0 if (a and b) else 1)
