"""Phase-4 server wiring — create_app + lifespan + thin routes (mocked LLMs).

Drives the real FastAPI app through ``TestClient`` (which runs the lifespan, so
``app.state`` is wired): POST ``/demo/beat-a`` runs the full choreography on the
mock Band spine and must land FLAGGED; the read routes then expose the case, the
seeded rules, the stats bar, and the verified audit chain. The replay route must
re-emit the recorded JSONL.

No live API, no network: ``litellm.acompletion`` is monkeypatched and the
pipeline's default model keys are registered as OpenRouter-style specs so
``resolve_call_kwargs`` reads no env. Stores point at a tmp dir.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from alpha_oversight.contracts.common import ModelSpec
from alpha_oversight.orchestration.surveillance_pipeline import _DEFAULT_MODELS


@pytest.fixture
def app_client(monkeypatch, patch_litellm, tmp_path):
    """A TestClient over a fully-wired app on tmp stores + mocked LLMs."""
    from alpha_oversight.reused import gateway as gw

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
        yield client


def test_beat_a_flags_and_audit_verifies(app_client):
    # The seeded registry is live from second 0.
    rules = app_client.get("/rules").json()
    assert any(r["id"] == "FINRA-5210-layering" for r in rules)

    # Drive Beat-A end to end through the app.
    resp = app_client.post("/demo/beat-a")
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"] == "FLAGGED"
    assert body["verdict"]["rule_id"] == "FINRA-5210-layering"
    case_id = body["case_id"]

    # The case is listed + fetchable and agrees.
    cases = app_client.get("/cases").json()
    assert any(c["case_id"] == case_id and c["state"] == "FLAGGED" for c in cases)
    one = app_client.get(f"/cases/{case_id}").json()
    assert one["state"] == "FLAGGED"

    # The audit lineage for this case verifies over the produced JSONL.
    audit = app_client.get(f"/cases/{case_id}/audit").json()
    assert audit["verified"] is True
    assert len(audit["entries"]) >= 1
    assert all(e["case_id"] == case_id for e in audit["entries"])

    # Stats bar reflects the flagged case + the active rule count.
    stats = app_client.get("/stats").json()
    assert stats["flagged"] >= 1
    assert stats["active_rules"] >= 4

    # The replay route re-emits the recorded case as SSE frames.
    replay = app_client.get("/stream", params={"replay": case_id})
    assert replay.status_code == 200
    assert "data:" in replay.text


def test_get_unknown_case_404(app_client):
    assert app_client.get("/cases/nope").status_code == 404


def test_confirm_on_non_escalated_case_conflicts(app_client):
    """A FLAGGED case can't be 'confirmed' (illegal transition) -> 409, not silent."""
    body = app_client.post("/demo/beat-a").json()
    case_id = body["case_id"]
    assert body["state"] == "FLAGGED"
    # confirm is only legal from ESCALATED; from FLAGGED it must be rejected.
    resp = app_client.post(f"/cases/{case_id}/confirm")
    assert resp.status_code == 409
