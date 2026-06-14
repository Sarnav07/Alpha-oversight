"""Phase 5 — live rule codification + regression gate (no LLMs, no Band).

The Beat-B story end to end at the rule layer:
  1. the seed registry MISSES the 400ms layering evasion (PASS) — the gap.
  2. an escalated Case + the debate-resolved contested inputs (window_ms=500)
     ``derive_rule`` into a NEW LAYERING rule whose params actually catch the
     evasion (window widened past the ~390ms cancel span, depth >= 3).
  3. ``regression_gate`` builds a registry INCLUDING the new rule and asserts the
     evasion now FLAGs (the gate that blocks codifying a rule that doesn't work).
  4. ``RuleRegistryStore.codify`` persists it: ``count`` increments and the live
     engine over ``registry.active()`` now returns FLAG on the same evasion.

Pure deterministic math over the rule engine — exercises the real Phase-1A
engine/registry/scenarios, so a regression in any of them surfaces here too.
"""

from __future__ import annotations

from datetime import datetime, timezone

from alpha_oversight.contracts.case_contracts import ResolvedInputs
from alpha_oversight.contracts.rule_contracts import RuleFamily
from alpha_oversight.generators import scenarios
from alpha_oversight.rules import seed_rules
from alpha_oversight.rules.codify import derive_rule, regression_gate
from alpha_oversight.rules.engine import evaluate
from alpha_oversight.rules.registry import RuleRegistryStore
from alpha_oversight.state.state_machine import Case, CaseState


def _seeded_store(rules_db: str) -> RuleRegistryStore:
    store = RuleRegistryStore(rules_db)
    for r in seed_rules.seed_rules():
        store.codify(r)
    return store


def _escalated_layering_case() -> Case:
    """The Case the pipeline parks in ESCALATED for the Beat-B evasion.

    Features mirror the AnomalyDetector dump for a 4-level layering ladder; the
    verdict is the seed engine's PASS (the rules missed it), which is exactly
    why a human is being asked to confirm.
    """
    now = datetime(2026, 6, 14, 14, 5, 0, tzinfo=timezone.utc)
    return Case(
        case_id="case-beatb-1",
        room_id="surveillance",
        state=CaseState.ESCALATED,
        features={
            "cancel_to_fill": 0.0,
            "depth_levels": 4,
            "self_match_ratio": 0.0,
            "eod_print_spike": False,
        },
        verdict=None,
        created_at=now,
        updated_at=now,
    )


# ── 1. the gap: seed rules miss the 400ms evasion ────────────────────────────


def test_seed_registry_misses_novel_evasion(rules_db: str) -> None:
    store = _seeded_store(rules_db)
    evasion = scenarios.novel_layering_evasion()
    v = evaluate(evasion, ResolvedInputs(), store.active())
    assert v.result == "PASS", f"seed rules should miss the evasion; got {v.rule_id}"


# ── 2. derive_rule → a LAYERING rule that actually catches THIS evasion ───────


def test_derive_rule_yields_active_layering_rule_for_the_evasion() -> None:
    case = _escalated_layering_case()
    resolved = ResolvedInputs(window_ms=500, intent="manipulative")

    rule = derive_rule(case, resolved, confirmed_by="analyst-jane")

    assert rule.family is RuleFamily.LAYERING
    assert rule.status == "ACTIVE"
    # provenance ties the rule to the human + the case it was born from.
    assert rule.provenance == "human:analyst-jane/case-beatb-1"
    # the window is widened to the debate-resolved contested value (and so spans
    # the ~390ms cancel drip the seed 100ms window slipped).
    assert rule.params["window_ms"] >= 390
    # still a layering rule: a depth threshold the 4-level evasion meets.
    assert rule.params["min_depth_levels"] >= 3
    assert rule.params["min_depth_levels"] <= 4

    # The derived params, applied directly, trip the layering metric on the
    # evasion (no resolved override needed — the rule stands on its own).
    evasion = scenarios.novel_layering_evasion()
    tripped, cited = __import__(
        "alpha_oversight.rules.math_layering", fromlist=["metric"]
    ).metric(evasion, rule.params)
    assert tripped is True
    assert cited["depth_levels"] >= 3


# ── 3. regression_gate → True only when the evasion now FLAGs ─────────────────


def test_regression_gate_passes_for_a_catching_rule() -> None:
    case = _escalated_layering_case()
    resolved = ResolvedInputs(window_ms=500)
    rule = derive_rule(case, resolved, confirmed_by="analyst-jane")
    evasion = scenarios.novel_layering_evasion()

    assert regression_gate(rule, evasion, resolved) is True


def test_regression_gate_fails_for_a_non_catching_rule() -> None:
    """A rule whose window is still too tight does NOT regression-pass."""
    case = _escalated_layering_case()
    # An adversarially narrow resolved window: 50ms < the ~390ms cancel span.
    rule = derive_rule(case, ResolvedInputs(window_ms=50), confirmed_by="analyst-jane")
    evasion = scenarios.novel_layering_evasion()

    # The gate replays with empty resolved inputs (no override) so it is the
    # RULE that must catch the evasion, not a transient debate value.
    assert regression_gate(rule, evasion, ResolvedInputs()) is False


# ── 4. codify → live registry now FLAGs the same evasion ─────────────────────


def test_codify_then_live_engine_flags_the_evasion(rules_db: str) -> None:
    store = _seeded_store(rules_db)
    before = store.count()

    case = _escalated_layering_case()
    resolved = ResolvedInputs(window_ms=500)
    rule = derive_rule(case, resolved, confirmed_by="analyst-jane")
    evasion = scenarios.novel_layering_evasion()

    # gate must pass before we persist (the codify precondition).
    assert regression_gate(rule, evasion, resolved) is True

    store.codify(rule)
    assert store.count() == before + 1

    # the live registry now catches what the seed set missed.
    v = evaluate(evasion, ResolvedInputs(), store.active())
    assert v.result == "FLAG"
    assert v.rule_id == rule.id
    assert v.cited_metric is not None and "depth_levels" in v.cited_metric
