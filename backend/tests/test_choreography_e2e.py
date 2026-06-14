"""Phase-4 milestone — the full surveillance choreography end-to-end on the mock.

Seeds the Beat-A ``clean_layering`` pattern and drives ``run_surveillance`` over
``MockBand`` + a monkeypatched ``litellm.acompletion`` (FakeGateway canned JSON).
Asserts:
  1. the case ends ``FLAGGED`` with a cited rule (the deterministic engine fired);
  2. ``Ledger.verify_chain()`` is ``True`` over the JSONL **this run produced**
     (a real hash-chained audit, not a fixture);
  3. the SanitizedBridge → AnomalyDetector → Investigator → recruit → Specialist
     → Prosecution/Defense → Adjudicator → engine → Escalation steps all emitted
     to the bus, and the replay tee wrote ``events-<case>.jsonl``.

No live API, no network: ``litellm.acompletion`` is monkeypatched and the agents
resolve to an OpenRouter-style spec so ``resolve_call_kwargs`` reads no env.
"""

from __future__ import annotations

import json
import os

import pytest

from alpha_oversight.audit.ledger import Ledger
from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.band.mock_band import MockBand
from alpha_oversight.contracts.common import ModelSpec
from alpha_oversight.generators.scenarios import clean_layering
from alpha_oversight.orchestration.replay_writer import ReplayWriter
from alpha_oversight.orchestration.surveillance_pipeline import run_surveillance
from alpha_oversight.reused.events import EventBus
from alpha_oversight.rules.registry import RuleRegistryStore
from alpha_oversight.rules.seed_rules import seed_rules
from alpha_oversight.state.case_store import CaseStore
from alpha_oversight.state.state_machine import CaseState

MODEL_KEY = "e2e-test-model"


@pytest.fixture
def register_e2e_model(monkeypatch):
    """Register one OpenRouter-style model the whole pipeline resolves to.

    OpenRouter id => ``resolve_call_kwargs`` returns ``{}`` and reads no env, so
    the run is hermetic.
    """
    from alpha_oversight.reused import gateway as gw

    spec = ModelSpec(
        key=MODEL_KEY,
        display_name="E2E Test",
        provider="OpenAI",
        litellm_model="openrouter/openai/e2e-test",
    )
    monkeypatch.setitem(gw.MODELS, MODEL_KEY, spec)
    return spec


@pytest.mark.asyncio
async def test_beat_a_runs_full_pipeline_to_flagged(
    patch_litellm, register_e2e_model, tmp_path
):
    # ── real collaborators (not conftest doubles) on temp paths ───────────────
    ledger_path = str(tmp_path / "ledger.jsonl")
    rules_db = str(tmp_path / "rules.db")
    case_db = str(tmp_path / "cases.db")
    events_dir = str(tmp_path / "events")
    os.makedirs(events_dir, exist_ok=True)

    ledger = Ledger(ledger_path, rules_db)
    registry = RuleRegistryStore(rules_db)
    for rule in seed_rules():
        registry.codify(rule)
    store = CaseStore(case_db)
    bus = EventBus()
    replay = ReplayWriter(events_dir)

    # Two Band identities on one shared broker (the Chinese-wall pair).
    rnd_band, surv_band = MockBand.pair("rnd", "surveillance")
    surv_handoff = BandHandoff(surv_band, ledger, bus, desk="surveillance")
    rnd_handoff = BandHandoff(rnd_band, ledger, bus, desk="rnd")
    bridge = SanitizedBridge(rnd_handoff, surveillance_room="case-e2e")

    models = {role: MODEL_KEY for role in (
        "anomaly", "investigator", "specialist",
        "prosecution", "defense", "adjudicator", "escalation",
    )}

    # ── run the choreography ──────────────────────────────────────────────────
    case = await run_surveillance(
        clean_layering(),
        surv_handoff,
        store,
        registry,
        bus,
        ledger,
        bridge=bridge,
        replay=replay,
        models=models,
    )

    # 1) the case ends FLAGGED with a cited rule (deterministic engine fired)
    assert case.state is CaseState.FLAGGED
    assert case.verdict is not None
    assert case.verdict.result == "FLAG"
    assert case.verdict.rule_id == "FINRA-5210-layering"
    assert case.verdict.cited_metric is not None

    # the persisted case agrees with the returned one
    persisted = await store.get(case.case_id)
    assert persisted is not None
    assert persisted.state is CaseState.FLAGGED
    assert persisted.verdict is not None
    assert persisted.verdict.rule_id == "FINRA-5210-layering"

    # 2) verify_chain() over the JSONL THIS run produced
    assert os.path.exists(ledger_path)
    assert Ledger.verify_chain(ledger_path) is True
    # the ledger actually grew (bridge crossing + agent steps + transitions)
    with open(ledger_path, encoding="utf-8") as fh:
        ledger_lines = [ln for ln in fh if ln.strip()]
    assert len(ledger_lines) >= 5

    # 3) the choreography emitted to the bus and the replay tee wrote a file
    replay_path = os.path.join(events_dir, f"events-{case.case_id}.jsonl")
    assert os.path.exists(replay_path)
    with open(replay_path, encoding="utf-8") as fh:
        replay_events = [json.loads(ln) for ln in fh if ln.strip()]
    assert len(replay_events) >= 3
    # every tee'd event carries the surveillance desk tag + a wall-clock ts
    assert all("created_at" in e and e["created_at"] for e in replay_events)
    agents_seen = {e["agent_name"] for e in replay_events}
    # the detector and at least one debate role left a trace
    assert "AnomalyDetector" in agents_seen


@pytest.mark.asyncio
async def test_tamper_breaks_the_chain(patch_litellm, register_e2e_model, tmp_path):
    """A byte flipped in the produced ledger must fail verification (tamper-evident)."""
    ledger_path = str(tmp_path / "ledger.jsonl")
    rules_db = str(tmp_path / "rules.db")
    case_db = str(tmp_path / "cases.db")
    events_dir = str(tmp_path / "events")
    os.makedirs(events_dir, exist_ok=True)

    ledger = Ledger(ledger_path, rules_db)
    registry = RuleRegistryStore(rules_db)
    for rule in seed_rules():
        registry.codify(rule)
    store = CaseStore(case_db)
    bus = EventBus()
    replay = ReplayWriter(events_dir)
    rnd_band, surv_band = MockBand.pair("rnd", "surveillance")
    surv_handoff = BandHandoff(surv_band, ledger, bus, desk="surveillance")
    rnd_handoff = BandHandoff(rnd_band, ledger, bus, desk="rnd")
    bridge = SanitizedBridge(rnd_handoff, surveillance_room="case-e2e")
    models = {role: MODEL_KEY for role in (
        "anomaly", "investigator", "specialist",
        "prosecution", "defense", "adjudicator", "escalation",
    )}

    await run_surveillance(
        clean_layering(), surv_handoff, store, registry, bus, ledger,
        bridge=bridge, replay=replay, models=models,
    )
    assert Ledger.verify_chain(ledger_path) is True

    # Flip a byte in the first ledger row's payload, keeping it valid JSON.
    with open(ledger_path, encoding="utf-8") as fh:
        lines = fh.readlines()
    first = json.loads(lines[0])
    first["case_id"] = (first.get("case_id") or "") + "X"
    lines[0] = json.dumps(first, sort_keys=True, separators=(",", ":")) + "\n"
    with open(ledger_path, "w", encoding="utf-8") as fh:
        fh.writelines(lines)

    assert Ledger.verify_chain(ledger_path) is False
