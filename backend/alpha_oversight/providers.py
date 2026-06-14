"""Provider factory — per-provider api_base + key injection for litellm.

Centralizes routing so the gateway's litellm.acompletion sites can merge
``resolve_call_kwargs(spec)`` at ONE place each (Phase 1B). Featherless is
flat-rate but capped at 4 concurrent slots, so ALL featherless calls share a
single module-level semaphore.
"""

from __future__ import annotations

import asyncio

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


def register_models() -> None:
    """Insert demo ModelSpecs (AIML frontier + Featherless open) into MODELS."""
    raise NotImplementedError


def resolve_call_kwargs(spec: ModelSpec) -> dict:
    """``{"api_base":.., "api_key":os.environ[spec.key_env]}`` or ``{}`` for OpenRouter."""
    raise NotImplementedError


def is_featherless(spec: ModelSpec) -> bool:
    raise NotImplementedError
