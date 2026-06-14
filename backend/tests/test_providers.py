"""Phase 1B — providers.py unit tests (no live calls).

Covers:
- ``resolve_call_kwargs`` injects api_base + api_key for aimlapi.
- ``resolve_call_kwargs`` for featherless uses the litellm default base
  (no ``api_base`` key) but still injects the key.
- ``resolve_call_kwargs`` returns ``{}`` for an OpenRouter spec.
- ``FEATHERLESS_SEMAPHORE`` value is 4.
- Concurrent featherless calls through the gateway never exceed 4 in flight
  (verified with a counting fake ``litellm.acompletion``).
"""

from __future__ import annotations

import asyncio

import pytest

from alpha_oversight import providers
from alpha_oversight.contracts.common import ModelSpec


def _aiml_spec() -> ModelSpec:
    return ModelSpec(
        key="prosecution-frontier",
        display_name="Frontier (AI/ML API)",
        provider="aimlapi",
        litellm_model="aiml/some-frontier-id",
        api_base="https://api.aimlapi.com/v2",
        key_env="AIML_API_KEY",
    )


def _featherless_spec() -> ModelSpec:
    return ModelSpec(
        key="defense-open",
        display_name="Open (Featherless)",
        provider="featherless",
        litellm_model="featherless_ai/Org/Model",
        api_base=None,
        key_env="FEATHERLESS_AI_API_KEY",
    )


def _openrouter_spec() -> ModelSpec:
    # Default key_env, default (None) api_base => routed via OpenRouter.
    return ModelSpec(
        key="gpt-5.4",
        display_name="GPT 5.4",
        provider="OpenAI",
        litellm_model="openrouter/openai/gpt-5.4",
    )


def test_resolve_call_kwargs_aimlapi_injects_base_and_key(monkeypatch):
    monkeypatch.setenv("AIML_API_KEY", "aiml-secret")
    kwargs = providers.resolve_call_kwargs(_aiml_spec())
    assert kwargs["api_base"] == "https://api.aimlapi.com/v2"
    assert kwargs["api_key"] == "aiml-secret"


def test_resolve_call_kwargs_featherless_default_base(monkeypatch):
    monkeypatch.setenv("FEATHERLESS_AI_API_KEY", "feather-secret")
    kwargs = providers.resolve_call_kwargs(_featherless_spec())
    # Featherless uses litellm's built-in default base — never injected here.
    assert "api_base" not in kwargs
    assert kwargs["api_key"] == "feather-secret"


def test_resolve_call_kwargs_openrouter_is_empty():
    # OpenRouter specs carry no per-call override (gateway routes as-is).
    assert providers.resolve_call_kwargs(_openrouter_spec()) == {}


def test_is_featherless_detects_provider():
    assert providers.is_featherless(_featherless_spec()) is True
    assert providers.is_featherless(_aiml_spec()) is False
    assert providers.is_featherless(_openrouter_spec()) is False


def test_semaphore_value_is_four():
    assert providers.FEATHERLESS_SEMAPHORE._value == 4


@pytest.mark.asyncio
async def test_featherless_concurrency_never_exceeds_four(monkeypatch):
    """Drive many featherless calls through the gateway concurrently; a counting
    fake ``litellm.acompletion`` records peak in-flight and asserts it stays <=4.
    """
    monkeypatch.setenv("FEATHERLESS_AI_API_KEY", "feather-secret")

    from types import SimpleNamespace

    import litellm

    from alpha_oversight.reused import gateway as gw

    # Register a featherless model in the gateway registry.
    spec = _featherless_spec()
    monkeypatch.setitem(gw.MODELS, spec.key, spec)

    in_flight = 0
    peak = 0
    lock = asyncio.Lock()

    async def counting_acompletion(**kwargs):
        nonlocal in_flight, peak
        async with lock:
            in_flight += 1
            peak = max(peak, in_flight)
        # Yield control so other coroutines can pile up if the semaphore lets them.
        await asyncio.sleep(0.01)
        async with lock:
            in_flight -= 1
        message = SimpleNamespace(content='{"ok": true}', tool_calls=None)
        choice = SimpleNamespace(message=message, finish_reason="stop")
        usage = SimpleNamespace(prompt_tokens=1, completion_tokens=1)
        return SimpleNamespace(choices=[choice], usage=usage)

    monkeypatch.setattr(litellm, "acompletion", counting_acompletion)

    g = gw.LLMGateway()
    await asyncio.gather(
        *(g.call(spec.key, "sys", "user", max_retries=1) for _ in range(20))
    )

    assert peak <= 4, f"featherless concurrency exceeded cap: peak={peak}"
    assert peak >= 2, f"fake never overlapped (peak={peak}); test is not exercising concurrency"
