"""Live Beat-B co-evolution — REAL LLMs.

Injects the novel 400ms layering evasion. If the choreography ESCALATES (seed
rules miss it), runs the deterministic human-confirm codify path exactly as
``/cases/{id}/confirm`` does: derive_rule -> regression_gate -> registry.codify
-> re-evaluate -> FLAGGED, and prints Active Rules N -> N+1.

    .venv/bin/python scripts/live_beat_b.py
"""
from __future__ import annotations
import os, sys, asyncio

_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, os.path.abspath(_BACKEND))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from alpha_oversight.audit.ledger import Ledger
from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.band.mock_band import MockBand
from alpha_oversight.generators.scenarios import novel_layering_evasion
from alpha_oversight.orchestration.replay_writer import ReplayWriter
from alpha_oversight.orchestration.surveillance_pipeline import run_surveillance
from alpha_oversight.providers import register_models
from alpha_oversight.reused.events import EventBus
from alpha_oversight.rules import codify, engine
from alpha_oversight.rules.registry import RuleRegistryStore
from alpha_oversight.rules.seed_rules import seed_rules
from alpha_oversight.state.case_store import CaseStore
from alpha_oversight.state.state_machine import CaseState, next_state


async def main() -> int:
    base = "./data/live"; os.makedirs(base, exist_ok=True)
    for f in ("bb_ledger.jsonl", "bb_rules.db", "bb_cases.db"):
        p = os.path.join(base, f)
        if os.path.exists(p): os.remove(p)
    ev_dir = os.path.join(base, "bb_events"); os.makedirs(ev_dir, exist_ok=True)
    import shutil; shutil.rmtree(ev_dir); os.makedirs(ev_dir)

    register_models()
    ledger = Ledger(os.path.join(base, "bb_ledger.jsonl"), os.path.join(base, "bb_rules.db"))
    registry = RuleRegistryStore(os.path.join(base, "bb_rules.db"))
    for rule in seed_rules():
        registry.codify(rule)
    store = CaseStore(os.path.join(base, "bb_cases.db"))
    bus = EventBus(); replay = ReplayWriter(ev_dir)
    rnd_band, surv_band = MockBand.pair("rnd", "surveillance")
    surv_handoff = BandHandoff(surv_band, ledger, bus, desk="surveillance")
    rnd_handoff = BandHandoff(rnd_band, ledger, bus, desk="rnd")
    room = "case-live-bb"
    bridge = SanitizedBridge(rnd_handoff, surveillance_room=room)

    rules_before = len(registry.active())
    print(f"Active Rules (seed): {rules_before}")
    print("Injecting novel 400ms layering evasion on REAL LLMs…\n")

    case = await run_surveillance(
        novel_layering_evasion(), surv_handoff, store, registry, bus, ledger,
        bridge=bridge, replay=replay, models=None, surveillance_room=room,
    )
    rw = case.resolved_inputs.window_ms if case.resolved_inputs else None
    print(f"after choreography : state={case.state.value} "
          f"verdict={case.verdict.result if case.verdict else None} "
          f"adjudicated window_ms={rw}")

    if case.state is not CaseState.ESCALATED:
        print("\nNOTE: case did not ESCALATE (the adjudicator resolved a window that "
              "either caught or mis-scored it). Co-evolution needs the seed rules to "
              "MISS first — see report. Codify path is proven by the mock suite.")
        return 1

    # ── human confirm -> derive + regression-gate + codify (deterministic) ─────
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
    await store.transition(case.case_id, next_state(case.state, "confirm"),
                           verdict=reverdict)
    chain = Ledger.verify_chain(os.path.join(base, "bb_ledger.jsonl"))
    print(f"\nActive Rules: {rules_before} -> {rules_after}")
    print(f"re-evaluated verdict: {reverdict.result}  rule={reverdict.rule_id}")
    print(f"verify_chain() = {chain}")
    ok = rules_after == rules_before + 1 and reverdict.result == "FLAG" and chain
    print("\nRESULT:", "PASS ✅ (novel evasion ESCALATED -> codified -> PASS→FLAGGED, chain verified)"
          if ok else "REVIEW")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
