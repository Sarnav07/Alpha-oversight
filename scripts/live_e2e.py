"""Live end-to-end choreography — REAL LLMs (AI/ML API + Featherless).

Same pipeline as ``test_choreography_e2e`` but with litellm UN-patched and the
real model specs registered from ``.env`` via ``providers.register_models()``.
Drives the Beat-A ``clean_layering`` scenario through all 8 agents over MockBand
(the in-process Chinese-wall pair) + the deterministic rule engine, and asserts a
real FLAGGED verdict + ``verify_chain()`` over the JSONL this run produced.

    .venv/bin/python scripts/live_e2e.py
"""
from __future__ import annotations
import os, sys, json, time, asyncio

_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, os.path.abspath(_BACKEND))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from alpha_oversight.audit.ledger import Ledger
from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.band.mock_band import MockBand
from alpha_oversight.generators.scenarios import clean_layering
from alpha_oversight.orchestration.replay_writer import ReplayWriter
from alpha_oversight.orchestration.surveillance_pipeline import run_surveillance
from alpha_oversight.providers import register_models
from alpha_oversight.reused import gateway as gw
from alpha_oversight.reused.events import EventBus
from alpha_oversight.rules.registry import RuleRegistryStore
from alpha_oversight.rules.seed_rules import seed_rules
from alpha_oversight.state.case_store import CaseStore


async def main() -> int:
    base = "./data/live"
    os.makedirs(base, exist_ok=True)
    for f in ("e2e_ledger.jsonl", "e2e_rules.db", "e2e_cases.db"):
        p = os.path.join(base, f)
        if os.path.exists(p): os.remove(p)
    events_dir = os.path.join(base, "e2e_events"); os.makedirs(events_dir, exist_ok=True)

    register_models()
    print("Registered real models:")
    for k in ("open-triage", "prosecution-open", "defense-open",
              "adjudicator-open", "escalation-open", "adversary-frontier"):
        spec = gw.MODELS.get(k)
        print(f"   {k:22} -> {spec.litellm_model if spec else '(missing)'}")

    ledger = Ledger(os.path.join(base, "e2e_ledger.jsonl"), os.path.join(base, "e2e_rules.db"))
    registry = RuleRegistryStore(os.path.join(base, "e2e_rules.db"))
    for rule in seed_rules():
        registry.codify(rule)
    store = CaseStore(os.path.join(base, "e2e_cases.db"))
    bus = EventBus()
    replay = ReplayWriter(events_dir)

    rnd_band, surv_band = MockBand.pair("rnd", "surveillance")
    surv_handoff = BandHandoff(surv_band, ledger, bus, desk="surveillance")
    rnd_handoff = BandHandoff(rnd_band, ledger, bus, desk="rnd")
    bridge = SanitizedBridge(rnd_handoff, surveillance_room="case-live-e2e")

    print("\nRunning the full choreography on REAL LLMs (scenario: clean_layering)…")
    t = time.time()
    case = await run_surveillance(
        clean_layering(), surv_handoff, store, registry, bus, ledger,
        bridge=bridge, replay=replay, models=None, surveillance_room="case-live-e2e",
    )
    dt = time.time() - t

    lpath = os.path.join(base, "e2e_ledger.jsonl")
    chain = Ledger.verify_chain(lpath)
    nleaves = sum(1 for ln in open(lpath) if ln.strip())
    rpath = os.path.join(events_dir, f"events-{case.case_id}.jsonl")
    revents = [json.loads(ln) for ln in open(rpath)] if os.path.exists(rpath) else []
    models_used = sorted({e.get("model_id") for e in revents if e.get("model_id")})

    print("\n" + "=" * 60)
    print(f"case_id        : {case.case_id}")
    print(f"final state    : {case.state.value}")
    if case.verdict:
        print(f"verdict        : {case.verdict.result}  rule={case.verdict.rule_id}")
        print(f"cited_metric   : {case.verdict.cited_metric}")
    print(f"wall-clock     : {dt:5.1f}s")
    print(f"ledger leaves  : {nleaves}   verify_chain() = {chain}")
    print(f"replay events  : {len(revents)}")
    print(f"models on wire : {models_used}")
    agents = sorted({e['agent_name'] for e in revents})
    print(f"agents traced  : {agents}")
    print("=" * 60)

    flagged = case.state.value == "FLAGGED" and case.verdict and case.verdict.result == "FLAG"
    print("RESULT:", "PASS ✅ (real LLMs flipped PASS->FLAGGED + chain verified)"
          if (flagged and chain) else f"state={case.state.value} chain={chain} — REVIEW")
    return 0 if (flagged and chain) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
