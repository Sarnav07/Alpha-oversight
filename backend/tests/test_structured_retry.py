"""structured_completion transient-retry behaviour (no network).

Featherless caps model-switching at 4/minute on the $25 plan; the agent path must
retry that RateLimitError (backing off) rather than fail the case — but must NOT
retry a permanent error (e.g. BadRequest). ``asyncio.sleep`` is stubbed so the
backoff never actually waits.
"""

from __future__ import annotations

from types import SimpleNamespace

import litellm
import pytest
from pydantic import BaseModel

from alpha_oversight import structured
from alpha_oversight.contracts.common import ModelSpec
from alpha_oversight.reused import gateway as gw


class _Out(BaseModel):
    ok: bool


def _ok_response():
    msg = SimpleNamespace(content='{"ok": true}', tool_calls=None)
    return SimpleNamespace(
        choices=[SimpleNamespace(message=msg, finish_reason="stop")],
        usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
    )


@pytest.fixture
def featherless_spec(monkeypatch):
    spec = ModelSpec(
        key="rl-test", display_name="rl", provider="featherless",
        litellm_model="featherless_ai/Org/Model", api_base=None,
        key_env="FEATHERLESS_AI_API_KEY",
    )
    monkeypatch.setitem(gw.MODELS, "rl-test", spec)
    monkeypatch.setenv("FEATHERLESS_AI_API_KEY", "x")

    async def _nosleep(*_a, **_k):  # never actually wait out the backoff
        return None
    monkeypatch.setattr(structured.asyncio, "sleep", _nosleep)
    return spec


@pytest.mark.asyncio
async def test_retries_rate_limit_then_succeeds(featherless_spec, monkeypatch):
    calls = {"n": 0}

    async def flaky(**kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise litellm.RateLimitError(
                message="4 switches/min", llm_provider="featherless_ai",
                model="featherless_ai/Org/Model",
            )
        return _ok_response()

    monkeypatch.setattr(litellm, "acompletion", flaky)

    out = await structured.structured_completion(
        [{"role": "user", "content": "x"}], _Out, "rl-test")
    assert out.ok is True
    assert calls["n"] == 2  # one rate-limit, retried, then succeeded


@pytest.mark.asyncio
async def test_does_not_retry_permanent_error(featherless_spec, monkeypatch):
    calls = {"n": 0}

    async def bad(**kwargs):
        calls["n"] += 1
        raise litellm.BadRequestError(
            message="temperature deprecated", model="featherless_ai/Org/Model",
            llm_provider="featherless_ai",
        )

    monkeypatch.setattr(litellm, "acompletion", bad)

    with pytest.raises(litellm.BadRequestError):
        await structured.structured_completion(
            [{"role": "user", "content": "x"}], _Out, "rl-test")
    assert calls["n"] == 1  # permanent error → no retry
