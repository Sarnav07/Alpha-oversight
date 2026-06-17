"""Model-assignment wiring — the per-role, family-diversity matrix.

Pure unit checks (no network, no litellm): assert that ``register_models()``
installs each surveillance + adversary logical key from its own env var with the
right gateway prefix, that the four adversarial-boundary seats route to four
DISTINCT keys / families, that the adversary's adaptive-thinking model is given a
non-zero temperature, and that a partial env still registers every open seat (the
``or featherless_open_model`` fallback). Guards the bias-isolation invariant
against silent drift when models are re-tuned via .env.
"""

from __future__ import annotations

import pytest

from alpha_oversight import providers
from alpha_oversight.orchestration.surveillance_pipeline import (
    ADVERSARY_MODEL_KEY,
    _DEFAULT_MODELS,
)
from alpha_oversight.reused import gateway as gw

# (env var, logical key, expected litellm prefix, model id) — the intended matrix.
_MATRIX = [
    ("ADVERSARY_MODEL",              "adversary-frontier", "aiml",           "claude-opus-4-8"),
    ("FEATHERLESS_OPEN_MODEL",       "open-triage",        "featherless_ai", "Qwen/Qwen3-Next-80B-A3B-Instruct"),
    ("FEATHERLESS_PROSECUTION_MODEL","prosecution-open",   "featherless_ai", "moonshotai/Kimi-K2.7-Code"),
    ("FEATHERLESS_DEFENSE_MODEL",    "defense-open",       "featherless_ai", "deepseek-ai/DeepSeek-V4-Pro"),
    ("FEATHERLESS_ADJUDICATOR_MODEL","adjudicator-open",   "featherless_ai", "zai-org/GLM-5.2"),
    ("FEATHERLESS_ESCALATION_MODEL", "escalation-open",    "featherless_ai", "Qwen/Qwen3.5-397B-A17B"),
]


def _family(model_id: str) -> str:
    """The vendor/org of a model id: the org before '/', else the leading token."""
    return model_id.split("/")[0] if "/" in model_id else model_id.split("-")[0]


@pytest.fixture
def restore_models():
    """Snapshot/restore the process-wide MODELS registry around a test."""
    snapshot = dict(gw.MODELS)
    yield
    gw.MODELS.clear()
    gw.MODELS.update(snapshot)


def test_register_models_installs_each_role_key(monkeypatch, restore_models):
    monkeypatch.setenv("AIML_API_KEY", "x")
    monkeypatch.setenv("FEATHERLESS_AI_API_KEY", "x")
    for env, _key, _prefix, model_id in _MATRIX:
        monkeypatch.setenv(env, model_id)

    providers.register_models()

    for _env, key, prefix, model_id in _MATRIX:
        assert key in gw.MODELS, f"{key} not registered"
        spec = gw.MODELS[key]
        assert spec.litellm_model == f"{prefix}/{model_id}", (key, spec.litellm_model)

    # The adversary runs an adaptive-thinking model that rejects temperature=0;
    # it must be given the model's default (1.0). Open seats stay deterministic.
    assert gw.MODELS["adversary-frontier"].temperature == 1.0
    assert gw.MODELS["prosecution-open"].temperature == 0.0


def test_default_models_routes_critical_seats_to_distinct_keys():
    # The four adversarial-boundary seats must not collapse onto one key.
    seats = [
        ADVERSARY_MODEL_KEY,             # adversary (R&D)
        _DEFAULT_MODELS["prosecution"],  # prosecution
        _DEFAULT_MODELS["defense"],      # defense
        _DEFAULT_MODELS["adjudicator"],  # adjudicator
    ]
    assert len(set(seats)) == 4, f"critical seats share a key: {seats}"
    # Adversary is the only paid/frontier seat; the key courtroom seats are open.
    assert ADVERSARY_MODEL_KEY.endswith("-frontier")
    for role in ("prosecution", "defense", "adjudicator", "escalation"):
        assert _DEFAULT_MODELS[role].endswith("-open"), (role, _DEFAULT_MODELS[role])
    # Triage + specialist are intentionally consolidated onto one shared MoE
    # (non-key seats) to stay under Featherless's 4-model-switches/minute cap.
    assert _DEFAULT_MODELS["specialist"] == "open-triage"
    assert _DEFAULT_MODELS["anomaly"] == "open-triage"
    # The adversary key is never reused by a surveillance seat (one-way isolation).
    assert ADVERSARY_MODEL_KEY not in _DEFAULT_MODELS.values()


def test_critical_seats_are_four_distinct_families():
    by_key = {key: model_id for _env, key, _prefix, model_id in _MATRIX}
    critical = [
        by_key["adversary-frontier"],
        by_key["prosecution-open"],
        by_key["defense-open"],
        by_key["adjudicator-open"],
    ]
    families = [_family(m) for m in critical]
    assert len(set(families)) == 4, f"families not all distinct: {list(zip(critical, families))}"


def test_register_models_falls_back_to_open_when_role_blank(monkeypatch, restore_models):
    # A partial env (only the base open model set) still registers every open seat.
    monkeypatch.setenv("FEATHERLESS_AI_API_KEY", "x")
    monkeypatch.setenv("FEATHERLESS_OPEN_MODEL", "Org/Base")
    for env in (
        "FEATHERLESS_PROSECUTION_MODEL", "FEATHERLESS_DEFENSE_MODEL",
        "FEATHERLESS_ADJUDICATOR_MODEL", "FEATHERLESS_ESCALATION_MODEL",
    ):
        monkeypatch.delenv(env, raising=False)

    providers.register_models()

    for key in ("prosecution-open", "defense-open", "adjudicator-open", "escalation-open"):
        assert key in gw.MODELS, f"{key} not registered under fallback"
        assert gw.MODELS[key].litellm_model == "featherless_ai/Org/Base"
