"""Phase 1B — structured.py unit tests (no live calls).

``structured_completion`` does a JSON-object litellm call, validates the text
with ``schema.model_validate_json``, and on a ValidationError appends ONE repair
message (carrying the schema) and retries exactly once before raising
``StructuredError``.

Covers:
- valid JSON on first shot -> parsed model instance.
- malformed once, then valid -> repair path validates on the retry (exactly 2 calls).
- persistently bad -> ``StructuredError`` (exactly 2 calls: original + one repair).
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from alpha_oversight.structured import StructuredError, structured_completion


class Demo(BaseModel):
    name: str
    score: int


def _resp(content: str) -> SimpleNamespace:
    message = SimpleNamespace(content=content, tool_calls=None)
    choice = SimpleNamespace(message=message, finish_reason="stop")
    usage = SimpleNamespace(prompt_tokens=1, completion_tokens=1)
    return SimpleNamespace(choices=[choice], usage=usage)


class SequencedLLM:
    """Returns a fixed sequence of response contents, one per call."""

    def __init__(self, contents: list[str]) -> None:
        self._contents = contents
        self.calls: list[dict] = []

    async def acompletion(self, **kwargs):
        self.calls.append(kwargs)
        idx = min(len(self.calls) - 1, len(self._contents) - 1)
        return _resp(self._contents[idx])


def _register_demo_model(monkeypatch):
    """Make ``model_key='demo'`` resolvable in the gateway registry."""
    from alpha_oversight.contracts.common import ModelSpec
    from alpha_oversight.reused import gateway as gw

    spec = ModelSpec(
        key="demo",
        display_name="Demo",
        provider="OpenAI",
        litellm_model="openrouter/openai/demo",
    )
    monkeypatch.setitem(gw.MODELS, "demo", spec)


def _patch(monkeypatch, contents: list[str]) -> SequencedLLM:
    import litellm

    fake = SequencedLLM(contents)
    monkeypatch.setattr(litellm, "acompletion", fake.acompletion)
    _register_demo_model(monkeypatch)
    return fake


@pytest.mark.asyncio
async def test_valid_json_first_shot_returns_model(monkeypatch):
    fake = _patch(monkeypatch, ['{"name": "ok", "score": 7}'])
    out = await structured_completion(
        [{"role": "user", "content": "go"}], Demo, "demo"
    )
    assert isinstance(out, Demo)
    assert out.name == "ok" and out.score == 7
    assert len(fake.calls) == 1


@pytest.mark.asyncio
async def test_malformed_once_then_repair_succeeds(monkeypatch):
    fake = _patch(
        monkeypatch,
        ['{"name": "missing score"}', '{"name": "fixed", "score": 3}'],
    )
    out = await structured_completion(
        [{"role": "user", "content": "go"}], Demo, "demo"
    )
    assert isinstance(out, Demo)
    assert out.name == "fixed" and out.score == 3
    # Exactly one repair retry => two calls total.
    assert len(fake.calls) == 2
    # The repair turn must carry the JSON schema so the model can self-correct.
    repair_messages = fake.calls[1]["messages"]
    blob = " ".join(str(m.get("content", "")) for m in repair_messages)
    assert "score" in blob and "properties" in blob


@pytest.mark.asyncio
async def test_persistently_bad_raises_structured_error(monkeypatch):
    fake = _patch(
        monkeypatch,
        ['{"name": "still bad"}', '{"name": "still bad again"}', '{"name": "x"}'],
    )
    with pytest.raises(StructuredError):
        await structured_completion(
            [{"role": "user", "content": "go"}], Demo, "demo"
        )
    # Original + exactly one repair (max_repair=1) => two calls, no more.
    assert len(fake.calls) == 2
