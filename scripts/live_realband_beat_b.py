"""Live Beat-B (co-evolution) over REAL Band — the capstone.

The novel 400ms layering evasion is injected over the live Band spine (two real
PhoenixBand identities on the shared room). The seed rules MISS it, so the case
ESCALATES — the escalation packet is a REAL Band message addressed to the human
overseer. A human-confirm then runs the deterministic codify path (derive_rule ->
regression_gate -> registry.codify), Active Rules go 4 -> 5, and the same evasion
now FLAGs. verify_chain() holds over a ledger whose handoff leaves bind real
band_message_ids.

    .venv/bin/python scripts/live_realband_beat_b.py
"""
from __future__ import annotations
import json
import os
import sys
import uuid
import asyncio

_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, os.path.abspath(_BACKEND))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from alpha_oversight.audit.ledger import Ledger
from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.band.phoenix_band import PhoenixBand
from alpha_oversight.config import Settings
from alpha_oversight.generators.scenarios import novel_layering_evasion
from alpha_oversight.orchestration.surveillance_pipeline import run_surveillance
from alpha_oversight.providers import register_models
from alpha_oversight.reused.events import EventBus
from alpha_oversight.rules import codify, engine
from alpha_oversight.rules.registry import RuleRegistryStore
from alpha_oversight.rules.seed_rules import seed_rules
from alpha_oversight.state.case_store import CaseStore
from alpha_oversight.state.state_machine import CaseState, next_state


async def main() -> int:
    s = Settings.load()
    shared = s.band_shared_room or s.band_rnd_room
    if not (s.band_surv_api_key and s.band_rnd_api_key and shared):
        print("Missing Band creds / shared room in .env — cannot run.")
        return 2

    base = "./data/live"
    os.makedirs(base, exist_ok=True)
    for f in ("rbb_ledger.jsonl", "rbb_rules.db", "rbb_cases.db"):
        p = os.path.join(base, f)
        if os.path.exists(p):
            os.remove(p)

    register_models()
    ledger_path = os.path.join(base, "rbb_ledger.jsonl")
    ledger = Ledger(ledger_path, os.path.join(base, "rbb_rules.db"))
    registry = RuleRegistryStore(os.path.join(base, "rbb_rules.db"))
    for rule in seed_rules():
        registry.codify(rule)
    store = CaseStore(os.path.join(base, "rbb_cases.db"))
    bus = EventBus()

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

    rules_before = len(registry.active())
    case_id = f"case-rbb-{uuid.uuid4().hex[:8]}"
    print(f"Shared Band room : {shared}")
    print(f"Active Rules (seed): {rules_before}")
    print("Injecting novel 400ms layering evasion over REAL Band…")
    print("=" * 64)

    try:
        case = await run_surveillance(
            novel_layering_evasion(), surv_handoff, store, registry, bus, ledger,
            bridge=bridge, models=None, surveillance_room=shared, case_id=case_id,
        )
    finally:
        await surv_band.aclose()
        await rnd_band.aclose()

    rw = case.resolved_inputs.window_ms if case.resolved_inputs else None
    print(f"after choreography : state={case.state.value} "
          f"verdict={case.verdict.result if case.verdict else None} "
          f"adjudicated window_ms={rw}")

    if case.state is not CaseState.ESCALATED:
        print("\nNOTE: case did not ESCALATE (adjudicator resolved a catching window). "
              "Co-evolution needs the seed rules to MISS first — the codify path is "
              "proven by the mock suite + scripts/live_beat_b.py.")
        return 1

    resolved = case.resolved_inputs
    rule = codify.derive_rule(case, resolved, "compliance")
    gate_ok = codify.regression_gate(rule, case.events, resolved)
    print(f"\nhuman CONFIRM -> derived rule: {rule.id} ({rule.family.value} {rule.params})")
    print(f"regression_gate (evasion now FLAGs?) = {gate_ok}")
    if not gate_ok:
        print("RESULT: FAIL ❌ (regression gate rejected the derived rule)")
        return 1

    registry.codify(rule)
    rules_after = len(registry.active())
    reverdict = engine.evaluate(case.events, resolved, registry.active())
    await store.transition(case.case_id, next_state(case.state, "confirm"), verdict=reverdict)

    chain = Ledger.verify_chain(ledger_path)
    leaves = [json.loads(l) for l in open(ledger_path) if l.strip()]
    band_bound = [e for e in leaves if e.get("bmid") or e.get("band_message_id")]
    print(f"\nActive Rules: {rules_before} -> {rules_after}")
    print(f"re-evaluated verdict: {reverdict.result}  rule={reverdict.rule_id}")
    print(f"ledger leaves: {len(leaves)}  (Band-message-bound: {len(band_bound)})")
    print(f"verify_chain() = {chain}")
    print("=" * 64)
    ok = rules_after == rules_before + 1 and reverdict.result == "FLAG" and chain and band_bound
    print("RESULT:", "PASS ✅ (novel evasion ESCALATED over REAL Band -> codified -> 4→5 -> FLAG, chain verified)"
          if ok else "REVIEW ⚠️")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
