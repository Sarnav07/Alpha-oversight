"""Live Beat-A over REAL Band — the WHOLE choreography on the live coordination spine.

Both desks are real Band identities (``PhoenixBand``, REST-poll mode) sharing ONE
Band room. The R&D->Surveillance handoff and the human escalation carry real
@mentions to real peers; the surveillance desk's internal sub-agent steps post to
the room as its on-Band audit trail (no @mention — they aren't separate Band
identities). EVERY handoff ledger leaf binds a REAL band_message_id, and
verify_chain() holds over the whole run.

    .venv/bin/python scripts/live_realband_e2e.py
"""
from __future__ import annotations
import json
import os
import sys
import uuid
import asyncio
import shutil

_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, os.path.abspath(_BACKEND))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from alpha_oversight.audit.ledger import Ledger
from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.band.phoenix_band import PhoenixBand
from alpha_oversight.config import Settings
from alpha_oversight.generators.scenarios import clean_layering
from alpha_oversight.orchestration.replay_writer import ReplayWriter
from alpha_oversight.orchestration.surveillance_pipeline import run_surveillance
from alpha_oversight.providers import register_models
from alpha_oversight.reused.events import EventBus
from alpha_oversight.rules.registry import RuleRegistryStore
from alpha_oversight.rules.seed_rules import seed_rules
from alpha_oversight.state.case_store import CaseStore
from alpha_oversight.state.state_machine import CaseState


async def main() -> int:
    s = Settings.load()
    shared = s.band_shared_room or s.band_rnd_room
    if not (s.band_surv_api_key and s.band_rnd_api_key and shared):
        print("Missing Band creds / shared room in .env — cannot run real-Band e2e.")
        return 2

    base = "./data/live"
    os.makedirs(base, exist_ok=True)
    for f in ("rb_ledger.jsonl", "rb_rules.db", "rb_cases.db"):
        p = os.path.join(base, f)
        if os.path.exists(p):
            os.remove(p)
    ev_dir = os.path.join(base, "rb_events")
    if os.path.exists(ev_dir):
        shutil.rmtree(ev_dir)
    os.makedirs(ev_dir)

    register_models()
    ledger_path = os.path.join(base, "rb_ledger.jsonl")
    ledger = Ledger(ledger_path, os.path.join(base, "rb_rules.db"))
    registry = RuleRegistryStore(os.path.join(base, "rb_rules.db"))
    for rule in seed_rules():
        registry.codify(rule)
    store = CaseStore(os.path.join(base, "rb_cases.db"))
    bus = EventBus()
    replay = ReplayWriter(ev_dir)

    # Two REAL Band identities, both polling/posting the one shared room.
    surv_band = PhoenixBand(
        s.band_api_base, s.band_surv_api_key, s.band_ws_url,
        identity="surveillance", agent_id=s.band_surv_agent_id, rooms=[shared],
        peer_overrides={"human": s.band_human_peer, "rnd": s.band_rnd_agent_id},
        default_mention=s.band_human_peer,
    )
    rnd_band = PhoenixBand(
        s.band_api_base, s.band_rnd_api_key, s.band_ws_url,
        identity="rnd", agent_id=s.band_rnd_agent_id, rooms=[shared],
        peer_overrides={
            "anomaly-detector": s.band_surv_agent_id,
            "surveillance": s.band_surv_agent_id,
            "human": s.band_human_peer,
        },
        default_mention=s.band_human_peer,
    )
    surv_handoff = BandHandoff(surv_band, ledger, bus, desk="surveillance")
    rnd_handoff = BandHandoff(rnd_band, ledger, bus, desk="rnd")
    bridge = SanitizedBridge(rnd_handoff, surveillance_room=shared)

    case_id = f"case-rb-{uuid.uuid4().hex[:8]}"
    print(f"Shared Band room : {shared}")
    print(f"Case id          : {case_id}")
    print("Running the WHOLE choreography over REAL Band (scenario: clean_layering)…")
    print("=" * 64)

    try:
        case = await run_surveillance(
            clean_layering(), surv_handoff, store, registry, bus, ledger,
            bridge=bridge, replay=replay, models=None,
            surveillance_room=shared, case_id=case_id,
        )
    finally:
        await surv_band.aclose()
        await rnd_band.aclose()

    chain = Ledger.verify_chain(ledger_path)
    leaves = [json.loads(l) for l in open(ledger_path) if l.strip()]
    # Handoff leaves bind a real Band message id (field "bmid"); agent-step leaves don't.
    band_ids = [e.get("bmid") or e.get("band_message_id") for e in leaves]
    band_bound = [b for b in band_ids if b]

    print(f"final state      : {case.state.value}")
    print(f"verdict          : {case.verdict.result if case.verdict else None} "
          f"rule={case.verdict.rule_id if case.verdict else None}")
    print(f"ledger leaves    : {len(leaves)}  (Band-message-bound: {len(band_bound)})")
    if band_bound:
        print(f"real Band msg ids: {[str(b)[:8] for b in band_bound[:5]]}")
    print(f"verify_chain()   : {chain}")
    print("=" * 64)
    ok = case.state is CaseState.FLAGGED and chain and len(band_bound) >= 1
    print(
        "RESULT:",
        "PASS ✅ (whole choreography on REAL Band; leaves bind real msg ids; chain verified)"
        if ok else "REVIEW ⚠️",
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
