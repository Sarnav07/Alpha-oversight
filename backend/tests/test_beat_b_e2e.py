"""Beat-B end-to-end — the co-evolution loop closes on the mock spine.

The full Beat-B story, wired through the REAL FastAPI app + the REAL surveillance
pipeline on ``MockBand`` + a monkeypatched ``litellm.acompletion`` (FakeGateway
canned JSON):

  1. inject ``novel_layering_evasion`` via the SanitizedBridge and run the
     surveillance choreography. The seed rules MISS the 400ms variant (engine
     PASS), so the case lands ``ESCALATED`` (not CLOSED) carrying the order
     events + the debate-resolved inputs + features (the codify inputs).
  2. POST ``/cases/{id}/confirm`` drives the codify path: a NEW LAYERING rule is
     derived from the case, the regression gate asserts the evasion now FLAGs,
     the registry count goes 4 -> 5, and the case flips ESCALATED -> FLAGGED.
  3. ``Ledger.verify_chain()`` is ``True`` over the JSONL the whole run (pipeline
     + the on-confirm ``rule_codified`` leaf) produced.

No live API, no network: ``litellm.acompletion`` is monkeypatched and every
pipeline default model key is registered as an OpenRouter-style spec so
``resolve_call_kwargs`` reads no env. Stores point at a private tmp dir.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from alpha_oversight.contracts.common import ModelSpec
from alpha_oversight.orchestration.surveillance_pipeline import _DEFAULT_MODELS

# The Beat-B canned LLM payload: suspicious + a 4-level layering shape (so the
# Investigator recruits the layering specialist). Crucially the ADJUDICATOR
# resolves ``window_ms=0`` — the debate does NOT widen the seed rules' own
# window at the engine step, so the 400ms variant genuinely slips the seed set
# (PASS -> ESCALATED). The wider window is the HUMAN's call: codify derives the
# v2 layering rule (window 500) on confirm. (A resolved window > 0 here would
# override every seed rule's window and make Beat-B FLAG instantly — the very
# thing Beat-B must avoid.)
_BEAT_B_PAYLOAD: dict = {
    "suspicious": True,
    "features": {
        "cancel_to_fill": 0.0,
        "depth_levels": 4,
        "self_match_ratio": 0.0,
        "eod_print_spike": False,
    },
    "case_id": "case-beatb",
    "specialist": "@layer-spec",
    "rationale": "four sub-best-bid levels pulled — layering",
    "candidate_inputs": {"window_ms": 0},
    "headline": "economic layering, widened cancel window",
    "detail": "same shape as the known pattern, cancels dripped to ~400ms",
    "claimed_inputs": {"window_ms": 0},
    "window_ms": 0,
    "bona_fide_ids": [],
    "intent": "manipulative",
    "packet": {"summary": "novel 400ms layering variant"},
    "recommend": "escalate",
    "events": [],
    "params": {},
}


@pytest.fixture
def beat_b_client(monkeypatch, patch_litellm, tmp_path):
    """A TestClient over a fully-wired app on tmp stores + Beat-B canned LLMs."""
    from alpha_oversight.reused import gateway as gw

    # Drive every agent with the Beat-B payload (4-level layering, window 500ms).
    patch_litellm.set_payload(dict(_BEAT_B_PAYLOAD))

    # Register every pipeline default model key as a hermetic OpenRouter spec.
    for key in set(_DEFAULT_MODELS.values()):
        monkeypatch.setitem(
            gw.MODELS,
            key,
            ModelSpec(
                key=key,
                display_name=key,
                provider="OpenAI",
                litellm_model=f"openrouter/openai/{key}",
            ),
        )

    # Point all stores at a private tmp dir.
    monkeypatch.setenv("LEDGER_DIR", str(tmp_path / "ledger"))
    monkeypatch.setenv("EVENTS_DIR", str(tmp_path / "events"))
    monkeypatch.setenv("CASE_DB", str(tmp_path / "cases.db"))
    monkeypatch.setenv("RULES_DB", str(tmp_path / "rules.db"))
    monkeypatch.setenv("MEMORY_DB", str(tmp_path / "memory.db"))

    from alpha_oversight.server.app import create_app

    with TestClient(create_app()) as client:
        # Expose the on-disk ledger path so the test can verify_chain over it.
        client.ledger_path = str(tmp_path / "ledger" / "ledger.jsonl")  # type: ignore[attr-defined]
        yield client


def test_beat_b_escalates_then_confirm_codifies_and_flags(beat_b_client):
    from alpha_oversight.audit.ledger import Ledger

    client = beat_b_client

    # The seed registry is live (4 rules) and misses nothing yet.
    rules_before = client.get("/rules").json()
    assert len(rules_before) == 4
    assert any(r["id"] == "FINRA-5210-layering" for r in rules_before)

    # ── 1. Beat-B: inject the novel evasion -> rules PASS -> ESCALATED ─────────
    resp = client.post("/demo/beat-b")
    assert resp.status_code == 200
    body = resp.json()
    case_id = body["case_id"]
    # The rules MISSED it (engine PASS) yet the case is ESCALATED, not CLOSED.
    assert body["state"] == "ESCALATED", body
    assert body["verdict"]["result"] == "PASS"
    assert body["verdict"]["rule_id"] is None

    # The escalated case persists the codify inputs: the order events + the
    # debate-resolved inputs + the detector features.
    one = client.get(f"/cases/{case_id}").json()
    assert one["state"] == "ESCALATED"
    assert len(one["events"]) == len(__novel())  # the full evasion sequence
    # The debate left the engine window untouched (so the seed rules missed it);
    # the wider window is codified by the human on confirm, not here.
    assert one["resolved_inputs"]["window_ms"] == 0
    assert one["features"]["depth_levels"] == 4

    # ── 2. POST /confirm -> derive + regression-gate + codify + ESCALATED->FLAGGED
    confirm = client.post(f"/cases/{case_id}/confirm")
    assert confirm.status_code == 200, confirm.text
    cbody = confirm.json()

    # The case flipped to FLAGGED on the codify path.
    assert cbody["case"]["state"] == "FLAGGED"
    # A new LAYERING rule was codified, gated, and tied to the human + case.
    assert cbody["codified"] is True
    assert cbody["regression_passed"] is True
    assert cbody["rule"]["family"] == "layering"
    assert cbody["rule"]["provenance"].startswith("human:")
    assert case_id in cbody["rule"]["provenance"]

    # Active Rules 4 -> 5 (the on-screen counter increments).
    rules_after = client.get("/rules").json()
    assert len(rules_after) == 5
    new_rule = next(r for r in rules_after if r["id"] == cbody["rule"]["id"])
    assert new_rule["family"] == "layering"
    assert new_rule["params"]["window_ms"] >= 390  # spans the ~390ms cancel drip

    # The persisted case agrees: FLAGGED.
    persisted = client.get(f"/cases/{case_id}").json()
    assert persisted["state"] == "FLAGGED"

    # ── 3. The live engine now FLAGs the same evasion the seed set missed ──────
    stats = client.get("/stats").json()
    assert stats["active_rules"] == 5
    assert stats["flagged"] >= 1

    # ── 4. verify_chain() over the FULL run JSONL (pipeline + rule_codified leaf)
    ledger_path = client.ledger_path  # type: ignore[attr-defined]
    assert os.path.exists(ledger_path)
    assert Ledger.verify_chain(ledger_path) is True
    # the on-confirm codify wrote a rule_codified leaf for this case.
    import json as _json

    with open(ledger_path, encoding="utf-8") as fh:
        leaves = [_json.loads(ln) for ln in fh if ln.strip()]
    codified_leaves = [
        e for e in leaves if e.get("case_id") == case_id and e.get("kind") == "rule_codified"
    ]
    assert len(codified_leaves) >= 1


def test_confirm_is_idempotent_only_from_escalated(beat_b_client):
    """A second confirm (case already FLAGGED) is rejected, not silently re-run."""
    client = beat_b_client
    case_id = client.post("/demo/beat-b").json()["case_id"]

    first = client.post(f"/cases/{case_id}/confirm")
    assert first.status_code == 200
    assert first.json()["case"]["state"] == "FLAGGED"

    # Confirm is only legal from ESCALATED; from FLAGGED it must 409 (no double codify).
    second = client.post(f"/cases/{case_id}/confirm")
    assert second.status_code == 409


def test_reject_closes_an_escalated_case_without_codifying(beat_b_client):
    """POST /reject on an ESCALATED case -> CLOSED(dismissed); no new rule."""
    client = beat_b_client
    case_id = client.post("/demo/beat-b").json()["case_id"]
    assert client.get(f"/cases/{case_id}").json()["state"] == "ESCALATED"

    before = len(client.get("/rules").json())
    resp = client.post(f"/cases/{case_id}/reject")
    assert resp.status_code == 200
    assert resp.json()["case"]["state"] == "CLOSED"
    # No rule was codified on a dismissal.
    assert len(client.get("/rules").json()) == before


def __novel():
    from alpha_oversight.generators.scenarios import novel_layering_evasion

    return novel_layering_evasion()
