"""Provider factory — per-provider api_base + key injection for litellm.

Centralizes routing so the gateway's litellm.acompletion sites can merge
``resolve_call_kwargs(spec)`` at ONE place each (Phase 1B). Featherless is
flat-rate but capped at 4 concurrent slots, so ALL featherless calls share a
single module-level semaphore.
"""

from __future__ import annotations

import asyncio
import os

import litellm

from alpha_oversight.contracts.common import ModelSpec

# Reasoning models (e.g. gpt-5-mini) reject temperature != 1 and a few other
# params. Let litellm silently drop any param a provider doesn't support,
# process-wide, so the single ``ModelSpec.temperature`` default can never 400 the
# escalation role on camera. (agent_loop also sets this; we re-assert it here in
# the foundational routing module so the guarantee is import-order-independent —
# structured_completion imports providers, not agent_loop.)
litellm.drop_params = True

PROVIDERS: dict[str, dict] = {
    "aimlapi": {
        "prefix": "aiml",
        "api_base": "https://api.aimlapi.com/v2",
        "key_env": "AIML_API_KEY",
    },
    "aimlapi2": {
        "prefix": "aiml",
        "api_base": "https://api.aimlapi.com/v2",
        "key_env": "AIML_API_KEY_2",
    },
    "featherless": {
        "prefix": "featherless_ai",
        "api_base": None,
        "key_env": "FEATHERLESS_AI_API_KEY",
    },
    "featherless2": {
        "prefix": "featherless_ai",
        "api_base": None,
        "key_env": "FEATHERLESS_AI_API_KEY_2",
    },
    "featherless3": {
        "prefix": "featherless_ai",
        "api_base": None,
        "key_env": "FEATHERLESS_AI_API_KEY_3",
    },
}

# One semaphore per Featherless account (each has its own 4-unit cap).
FEATHERLESS_SEMAPHORE: asyncio.Semaphore = asyncio.Semaphore(4)   # account 1
FEATHERLESS_SEMAPHORE_2: asyncio.Semaphore = asyncio.Semaphore(4)  # account 2
FEATHERLESS_SEMAPHORE_3: asyncio.Semaphore = asyncio.Semaphore(4)  # account 3

_FEATHERLESS_PREFIX = PROVIDERS["featherless"]["prefix"]  # "featherless_ai"


def _provider_of(spec: ModelSpec) -> str | None:
    """Return the PROVIDERS key whose ``prefix`` matches ``spec.litellm_model``.

    For the two Featherless accounts we disambiguate by ``key_env``.
    Returns ``None`` for OpenRouter / any unmatched (default) route.
    """
    head = spec.litellm_model.split("/", 1)[0]
    for name, cfg in PROVIDERS.items():
        if head == cfg["prefix"] and cfg["key_env"] == spec.key_env:
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
    """True iff ``spec`` routes to either Featherless account."""
    return spec.litellm_model.split("/", 1)[0] == _FEATHERLESS_PREFIX


def featherless_semaphore(spec: ModelSpec) -> asyncio.Semaphore:
    """Return the semaphore for the Featherless account this spec uses."""
    if spec.key_env == PROVIDERS["featherless3"]["key_env"]:
        return FEATHERLESS_SEMAPHORE_3
    if spec.key_env == PROVIDERS["featherless2"]["key_env"]:
        return FEATHERLESS_SEMAPHORE_2
    return FEATHERLESS_SEMAPHORE


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
    # The four critical seats (adversary/prosecution/defense/adjudicator) each run
    # a DISTINCT model family — no shared blind spots across an adversarial
    # boundary. Triage + specialist share ``open-triage`` (one fast MoE) so a single
    # case stays within Featherless's $25-plan cap of 4 model-switches/minute. Each
    # per-role open key falls back to ``featherless_open_model`` when unset.
    _open = s.featherless_open_model
    # Featherless account routing — each account is an independent 4-unit pool:
    #   acct 1 (key1): triage ×3 — fast Qwen MoE, never contends
    #   acct 2 (key2): prosecution + defense — debate pair isolated
    #   acct 3 (key3): adjudicator + escalation — post-debate, never overlaps acct 2
    # Falls back to key1 for any unset key (single-account safe mode).
    _key1 = "FEATHERLESS_AI_API_KEY"
    _key2 = "FEATHERLESS_AI_API_KEY_2" if s.featherless_ai_api_key_2 else _key1
    _key3 = "FEATHERLESS_AI_API_KEY_3" if s.featherless_ai_api_key_3 else _key1
    _aiml1 = "AIML_API_KEY"
    _aiml2 = "AIML_API_KEY_2" if s.aiml_api_key_2 else _aiml1
    specs = [
        # ── AIML account 1 — adversary (R&D, Anthropic family) ──
        ("adversary-frontier", s.adversary_model, "aimlapi", "aiml", aiml_base, _aiml1),
        # ── AIML account 2 (or 1 fallback) — frontier back-compat keys ──
        ("prosecution-frontier", s.aiml_frontier_model, "aimlapi", "aiml", aiml_base, _aiml2),
        ("escalation-frontier", s.aiml_frontier_model_alt or s.aiml_frontier_model,
         "aimlapi", "aiml", aiml_base, _aiml2),
        ("aiml-free", s.aiml_free_model, "aimlapi", "aiml", aiml_base, _aiml1),
        # ── Featherless acct 1 — triage (fast Qwen MoE) ──
        ("open-triage", _open, "featherless", "featherless_ai", None, _key1),
        # ── Featherless acct 2 — prosecution + defense (debate pair) ──
        ("prosecution-open", s.featherless_prosecution_model or _open, "featherless", "featherless_ai", None, _key2),
        ("defense-open", s.featherless_defense_model or _open, "featherless", "featherless_ai", None, _key2),
        # ── Featherless acct 3 — adjudicator + escalation (post-debate) ──
        ("adjudicator-open", s.featherless_adjudicator_model or _open, "featherless", "featherless_ai", None, _key3),
        ("escalation-open", s.featherless_escalation_model or _open, "featherless", "featherless_ai", None, _key3),
    ]
    for key, raw_id, provider, prefix, api_base, key_env in specs:
        if not raw_id:
            continue  # not configured this round — skip (do NOT hardcode unverified ids)
        MODELS[key] = ModelSpec(
            key=key,
            display_name=key,
            provider=provider,
            litellm_model=f"{prefix}/{raw_id}",
            # Reasoning models (gpt-5-mini) count their hidden reasoning against
            # max_completion_tokens; 4096 can truncate a packet to empty. Give
            # every demo role headroom — it is a ceiling, not a target (models
            # stop at EOS), so non-reasoning roles pay nothing for it.
            max_tokens=8192,
            # The adversary's frontier model (claude-opus-4-8) is an adaptive-
            # thinking model that rejects an explicit temperature, and litellm has
            # no metadata to drop it on the aiml/ route — so send the model's own
            # default (temperature=1), which also suits a creative red-teamer. Open
            # seats stay deterministic at 0.0 for stable structured JSON.
            temperature=1.0 if key == "adversary-frontier" else 0.0,
            api_base=api_base,
            key_env=key_env,
        )
