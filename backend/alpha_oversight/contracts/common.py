# LIFTED FROM trader-arena/arena/contracts/common.py:82 — ModelSpec; EXTENDED with api_base + key_env (Phase 0).
"""Shared model spec used by the gateway / agent loops.

Only ``ModelSpec`` is reused here (the trader-arena file also held track/season
config models that Alpha & Oversight does not use). ``api_base`` and ``key_env``
are the Phase-0 extension that lets the gateway route per-provider (AI/ML API,
Featherless) instead of only OpenRouter — see ``providers.resolve_call_kwargs``.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ModelSpec(BaseModel):
    """Specification for an LLM model."""

    key: str = Field(description="Short key: e.g. gpt-5.4, claude-opus")
    display_name: str
    provider: str = Field(description="openai, anthropic, featherless, aimlapi, ...")
    litellm_model: str = Field(description="litellm model string, e.g. 'aiml/<id>'")
    max_tokens: int = 4096
    temperature: float = 0.0
    # ── Phase-0 extension: per-provider routing ──
    api_base: str | None = None
    key_env: str = "OPENROUTER_API_KEY"
