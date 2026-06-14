"""Import-clean gate: every package module must import without side effects.

If any module has a broken import (wrong path, missing dep, circular import),
this test fails at collection/run time. Stub bodies raise NotImplementedError
when *called*, never when imported, so importing them is safe here.
"""

import importlib

import pytest

MODULES = [
    # package roots
    "alpha_oversight",
    "alpha_oversight.config",
    "alpha_oversight.providers",
    "alpha_oversight.structured",
    # reused
    "alpha_oversight.reused.agent_loop",
    "alpha_oversight.reused.tool_registry",
    "alpha_oversight.reused.gateway",
    "alpha_oversight.reused.cost_tracker",
    "alpha_oversight.reused.events",
    "alpha_oversight.reused.compaction",
    "alpha_oversight.reused.trace_models",
    "alpha_oversight.reused.eval_gate",
    "alpha_oversight.reused.quant.contracts",
    "alpha_oversight.reused.quant.data_contracts",
    "alpha_oversight.reused.quant.trading_contracts",
    "alpha_oversight.reused.quant.cost_model",
    "alpha_oversight.reused.quant.market_simulator",
    "alpha_oversight.reused.quant.order_validator",
    "alpha_oversight.reused.quant.portfolio",
    "alpha_oversight.reused.quant.backtest_engine",
    # contracts
    "alpha_oversight.contracts.common",
    "alpha_oversight.contracts.exchange_contracts",
    "alpha_oversight.contracts.order_events",
    "alpha_oversight.contracts.band_envelope",
    "alpha_oversight.contracts.rule_contracts",
    "alpha_oversight.contracts.case_contracts",
    # rules
    "alpha_oversight.rules.engine",
    "alpha_oversight.rules.math_spoofing",
    "alpha_oversight.rules.math_layering",
    "alpha_oversight.rules.math_wash_trade",
    "alpha_oversight.rules.math_marking",
    "alpha_oversight.rules.registry",
    "alpha_oversight.rules.seed_rules",
    "alpha_oversight.rules.codify",
    # generators
    "alpha_oversight.generators.scenarios",
    "alpha_oversight.generators.backtest_adapter",
    # band
    "alpha_oversight.band.transport",
    "alpha_oversight.band.mock_band",
    "alpha_oversight.band.handoff",
    "alpha_oversight.band.bridge",
    "alpha_oversight.band.phoenix_band",
    # memory
    "alpha_oversight.memory.scratchpad",
    "alpha_oversight.memory.prompt_sections",
    # audit
    "alpha_oversight.audit.canonical",
    "alpha_oversight.audit.ledger",
    # state
    "alpha_oversight.state.case_store",
    "alpha_oversight.state.state_machine",
    # agents
    "alpha_oversight.agents.base_agent",
    "alpha_oversight.agents.anomaly_detector",
    "alpha_oversight.agents.investigator",
    "alpha_oversight.agents.specialist",
    "alpha_oversight.agents.prosecution",
    "alpha_oversight.agents.defense",
    "alpha_oversight.agents.adjudicator",
    "alpha_oversight.agents.escalation_manager",
    "alpha_oversight.agents.adversary",
    "alpha_oversight.agents.specialist_registry",
    # orchestration
    "alpha_oversight.orchestration.surveillance_pipeline",
    "alpha_oversight.orchestration.replay_writer",
    "alpha_oversight.orchestration.rnd_loop",
    # server
    "alpha_oversight.server.app",
    "alpha_oversight.server.routes_stream",
    "alpha_oversight.server.routes_cases",
    "alpha_oversight.server.routes_human",
    "alpha_oversight.server.routes_demo",
]


@pytest.mark.parametrize("module_name", MODULES)
def test_module_imports(module_name: str) -> None:
    importlib.import_module(module_name)


def test_modelspec_extension() -> None:
    """ModelSpec must carry the Phase-0 routing extension."""
    from alpha_oversight.contracts.common import ModelSpec

    spec = ModelSpec(key="k", display_name="d", provider="p", litellm_model="x")
    assert spec.api_base is None
    assert spec.key_env == "OPENROUTER_API_KEY"


def test_tool_result_is_dataclass() -> None:
    """ToolResult must be the trader-arena dataclass (success/data/error), not Pydantic."""
    import dataclasses

    from alpha_oversight.reused.tool_registry import ToolResult

    assert dataclasses.is_dataclass(ToolResult)
    r = ToolResult(success=True, data="ok")
    assert r.success is True and r.data == "ok" and r.error is None


def test_envelope_alias_roundtrip() -> None:
    """Envelope uses a `from` alias and round-trips through a mention string."""
    from alpha_oversight.contracts.band_envelope import BandKind, Envelope

    env = Envelope(
        case_id="case-1",
        from_="investigator",
        to="spoof-spec",
        kind=BandKind.HANDOFF,
        payload={"k": "v"},
    )
    mention = env.to_mention()
    assert mention.startswith("@spoof-spec ")
    assert '"from":"investigator"' in mention
    back = Envelope.parse_mention(mention)
    assert back.from_ == "investigator"
    assert back.to == "spoof-spec"
    assert back.kind is BandKind.HANDOFF
    assert back.payload == {"k": "v"}
