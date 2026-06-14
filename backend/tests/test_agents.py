"""Phase 3C — agent wrapper unit tests (ALL LLM calls mocked).

Each ``SurveillanceAgent`` wrapper's ``run(user_prompt, schema)`` returns a valid
instance of its declared output schema against the ``FakeGateway`` canned JSON.
Single-shot roles (anomaly/specialist/prosecution/defense/adjudicator/escalation/
adversary) go straight through ``structured_completion``; the tool-using role
(investigator) runs the reused ``AgentLoop`` then validates ``AgentResult.parsed``
(design §5.8 — no double-parse). The on_action tee must publish to the EventBus
and append to the ledger.

No live API, no network: ``litellm.acompletion`` is monkeypatched and the model
key resolves to an OpenRouter-style spec so ``resolve_call_kwargs`` reads no env.
"""

from __future__ import annotations

import pytest

from alpha_oversight.agents.adjudicator import Adjudicator
from alpha_oversight.agents.adversary import Adversary
from alpha_oversight.agents.anomaly_detector import AnomalyDetector
from alpha_oversight.agents.defense import Defense
from alpha_oversight.agents.escalation_manager import EscalationManager
from alpha_oversight.agents.investigator import Investigator
from alpha_oversight.agents.prosecution import Prosecution
from alpha_oversight.agents.specialist import Specialist
from alpha_oversight.contracts.case_contracts import (
    AdversaryOut,
    AnomalyOut,
    Dossier,
    EscalationOut,
    InvestigationOut,
    ResolvedInputs,
    SpecialistOut,
)
from alpha_oversight.reused.tool_registry import (
    ToolDefinition,
    ToolRegistry,
    ToolResult,
)

MODEL_KEY = "agent-test"


@pytest.fixture
def register_test_model(monkeypatch):
    """Make ``MODEL_KEY`` resolvable in the gateway registry.

    OpenRouter-style litellm id => providers.resolve_call_kwargs returns {} and
    reads no env var (keeps the test hermetic).
    """
    from alpha_oversight.contracts.common import ModelSpec
    from alpha_oversight.reused import gateway as gw

    spec = ModelSpec(
        key=MODEL_KEY,
        display_name="Agent Test",
        provider="OpenAI",
        litellm_model="openrouter/openai/agent-test",
    )
    monkeypatch.setitem(gw.MODELS, MODEL_KEY, spec)
    return spec


@pytest.fixture
def empty_registry() -> ToolRegistry:
    return ToolRegistry()


@pytest.fixture
def tool_registry() -> ToolRegistry:
    """A registry with one no-op tool so the loop path is exercised."""
    reg = ToolRegistry()

    async def _noop(args: dict) -> ToolResult:
        return ToolResult(success=True, data="ok")

    reg.register(
        ToolDefinition(
            name="lookup_peers",
            description="List Band peers available for recruit.",
            parameters={"type": "object", "properties": {}},
        ),
        _noop,
    )
    return reg


def _build(cls, registry, fake_bus, fake_ledger):
    return cls(
        model_key=MODEL_KEY,
        system_prompt="role prompt",
        registry=registry,
        bus=fake_bus,
        ledger=fake_ledger,
        desk="surveillance",
    )


# ── Single-shot roles: structured_completion path ────────────────────────────


@pytest.mark.asyncio
async def test_anomaly_detector_returns_schema(
    patch_litellm, register_test_model, empty_registry, fake_bus, fake_ledger
):
    agent = _build(AnomalyDetector, empty_registry, fake_bus, fake_ledger)
    out = await agent.run("triage this window", AnomalyOut)
    assert isinstance(out, AnomalyOut)
    assert out.suspicious is True
    # features round-tripped from the canned payload
    assert out.features.depth_levels == 4
    # the on_action tee published to the bus and appended to the ledger
    assert len(fake_bus.events) >= 1
    assert fake_bus.events[-1]["desk"] == "surveillance"
    assert len(fake_ledger.entries) >= 1


@pytest.mark.asyncio
async def test_specialist_returns_schema(
    patch_litellm, register_test_model, empty_registry, fake_bus, fake_ledger
):
    agent = _build(Specialist, empty_registry, fake_bus, fake_ledger)
    out = await agent.run("propose contested inputs", SpecialistOut)
    assert isinstance(out, SpecialistOut)
    assert out.candidate_inputs == {"window_ms": 400}


@pytest.mark.asyncio
async def test_prosecution_returns_dossier(
    patch_litellm, register_test_model, empty_registry, fake_bus, fake_ledger
):
    agent = _build(Prosecution, empty_registry, fake_bus, fake_ledger)
    out = await agent.run("build the violation case", Dossier)
    assert isinstance(out, Dossier)
    assert out.headline == "canned headline"


@pytest.mark.asyncio
async def test_defense_returns_dossier(
    patch_litellm, register_test_model, empty_registry, fake_bus, fake_ledger
):
    agent = _build(Defense, empty_registry, fake_bus, fake_ledger)
    out = await agent.run("argue exoneration", Dossier)
    assert isinstance(out, Dossier)
    assert out.detail == "canned detail"


@pytest.mark.asyncio
async def test_adjudicator_returns_resolved_inputs(
    patch_litellm, register_test_model, empty_registry, fake_bus, fake_ledger
):
    agent = _build(Adjudicator, empty_registry, fake_bus, fake_ledger)
    out = await agent.run("pick contested inputs", ResolvedInputs)
    assert isinstance(out, ResolvedInputs)
    assert out.window_ms == 400


@pytest.mark.asyncio
async def test_escalation_manager_returns_escalation_out(
    patch_litellm, register_test_model, empty_registry, fake_bus, fake_ledger
):
    agent = _build(EscalationManager, empty_registry, fake_bus, fake_ledger)
    out = await agent.run("build the human packet", EscalationOut)
    assert isinstance(out, EscalationOut)
    assert out.recommend == "escalate"
    # rule_codified is optional and absent in the canned payload
    assert out.rule_codified is None


@pytest.mark.asyncio
async def test_adversary_returns_adversary_out(
    patch_litellm, register_test_model, empty_registry, fake_bus, fake_ledger
):
    agent = _build(Adversary, empty_registry, fake_bus, fake_ledger)
    out = await agent.run("evade the registry", AdversaryOut)
    assert isinstance(out, AdversaryOut)
    assert out.events == []


# ── Tool-using role: AgentLoop path, validate AgentResult.parsed ─────────────


@pytest.mark.asyncio
async def test_investigator_runs_loop_and_returns_schema(
    patch_litellm, register_test_model, tool_registry, fake_bus, fake_ledger
):
    agent = _build(Investigator, tool_registry, fake_bus, fake_ledger)
    out = await agent.run("open a case and recruit", InvestigationOut)
    assert isinstance(out, InvestigationOut)
    assert out.case_id == "case-test"
    assert out.specialist == "@layer-spec"
    # the loop's on_action tee fired at least once (user turn + assistant turn)
    assert len(fake_bus.events) >= 1
    assert len(fake_ledger.entries) >= 1


@pytest.mark.asyncio
async def test_default_schema_used_when_omitted(
    patch_litellm, register_test_model, empty_registry, fake_bus, fake_ledger
):
    # Each wrapper declares a default schema, so run() works without an explicit one.
    agent = _build(AnomalyDetector, empty_registry, fake_bus, fake_ledger)
    out = await agent.run("triage")
    assert isinstance(out, AnomalyOut)
