"""Provider factory — per-provider api_base + key injection for litellm.

Centralizes routing so the gateway's litellm.acompletion sites can merge
``resolve_call_kwargs(spec)`` at ONE place each (Phase 1B). Featherless is
flat-rate but capped at 4 concurrent slots, so ALL featherless calls share a
single module-level semaphore.
"""

from __future__ import annotations

import asyncio
import os

from alpha_oversight.contracts.common import ModelSpec

PROVIDERS: dict[str, dict] = {
    "aimlapi": {
        "prefix": "aiml",
        "api_base": "https://api.aimlapi.com/v2",
        "key_env": "AIML_API_KEY",
    },
    "featherless": {
        "prefix": "featherless_ai",
        "api_base": None,
        "key_env": "FEATHERLESS_AI_API_KEY",
    },
}

# Shared by ALL featherless calls process-wide (4-slot concurrency cap).
FEATHERLESS_SEMAPHORE: asyncio.Semaphore = asyncio.Semaphore(4)

_FEATHERLESS_PREFIX = PROVIDERS["featherless"]["prefix"]  # "featherless_ai"


def _provider_of(spec: ModelSpec) -> str | None:
    """Return the PROVIDERS key whose ``prefix`` matches ``spec.litellm_model``.

    litellm routes on the leading ``<prefix>/...`` segment of the model string,
    so that is the authoritative signal (not ``spec.provider``, a free-text
    label). Returns ``None`` for OpenRouter / any unmatched (default) route.
    """
    head = spec.litellm_model.split("/", 1)[0]
    for name, cfg in PROVIDERS.items():
        if head == cfg["prefix"]:
            return name
    return None


def resolve_call_kwargs(spec: ModelSpec) -> dict:
    """Per-call litellm overrides for ``spec``'s provider.

    aimlapi -> ``{"api_base": ..., "api_key": <env>}``.
    featherless -> ``{"api_key": <env>}`` (uses litellm's built-in default base,
    so ``api_base`` is intentionally omitted).
    OpenRouter / default -> ``{}`` (the gateway routes the model string as-is).
    """
    name = _provider_of(spec)
    if name is None:
        return {}
    kwargs: dict = {"api_key": os.environ[spec.key_env]}
    if spec.api_base is not None:
        kwargs["api_base"] = spec.api_base
    return kwargs


def is_featherless(spec: ModelSpec) -> bool:
    """True iff ``spec`` routes to Featherless (its calls must take a semaphore slot)."""
    return spec.litellm_model.split("/", 1)[0] == _FEATHERLESS_PREFIX


def register_models() -> None:
    """Insert demo ModelSpecs (AIML frontier + Featherless open) into the gateway
    ``MODELS`` registry from the environment.

    Idempotent and tolerant of empty env (so test/import paths never crash):
    only models whose litellm id is configured are registered. Keys are stable
    logical handles the surveillance agents reference.
    """
    from alpha_oversight.config import Settings
    from alpha_oversight.reused.gateway import MODELS

    s = Settings.load()
    aiml_base = s.aiml_api_base or PROVIDERS["aimlapi"]["api_base"]

    # (logical key, raw model id from env, provider name, litellm prefix, api_base)
    specs = [
        ("prosecution-frontier", s.aiml_frontier_model, "aimlapi", "aiml", aiml_base),
        ("escalation-frontier", s.aiml_frontier_model_alt or s.aiml_frontier_model,
         "aimlapi", "aiml", aiml_base),
        ("aiml-free", s.aiml_free_model, "aimlapi", "aiml", aiml_base),
        ("open-triage", s.featherless_open_model, "featherless", "featherless_ai", None),
        ("defense-open", s.featherless_defense_model or s.featherless_open_model,
         "featherless", "featherless_ai", None),
    ]
    for key, raw_id, provider, prefix, api_base in specs:
        if not raw_id:
            continue  # not configured this round — skip (do NOT hardcode unverified ids)
        key_env = PROVIDERS[provider]["key_env"]
        MODELS[key] = ModelSpec(
            key=key,
            display_name=key,
            provider=provider,
            litellm_model=f"{prefix}/{raw_id}",
            api_base=api_base,
            key_env=key_env,
        )
