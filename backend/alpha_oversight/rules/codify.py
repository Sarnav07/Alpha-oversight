"""Live rule codification + regression gate [Phase 5].

On human-confirm, a NEW parameterized rule is *derived* from the escalated case
and the debate-resolved contested inputs, then *gated*: the original evasion is
replayed through a registry that includes the new rule, and codification is only
allowed if the evasion now FLAGs. This is the demo's wow moment — the seed rules
missed a 400ms layering variant, a human confirms it, and the system writes a
rule that catches that exact evasion (and asserts so before persisting).

Pure deterministic — no LLMs, no Band. ``derive_rule`` maps the case into the
correct rule family with params taken from the contested inputs the debate set
(notably ``window_ms`` for layering/spoofing); ``regression_gate`` runs the real
``rules.engine.evaluate`` over the new rule and returns True iff result == FLAG.
"""

from __future__ import annotations

from alpha_oversight.contracts.case_contracts import ResolvedInputs
from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.contracts.rule_contracts import Rule, RuleFamily, Verdict
from alpha_oversight.rules import engine
from alpha_oversight.state.state_machine import Case

# A small slack added on top of the contested window so the derived rule's own
# params catch the evasion even when the engine applies no resolved override.
_WINDOW_SLACK_MS = 50
# The layering family is only meaningful at >= 3 stacked levels (the seed
# threshold and the regulatory tell), so the derived depth floor never drops
# below this regardless of what a single case happened to show.
_MIN_LAYERING_DEPTH = 3

# Which verdict ``cited_metric`` key implies which family — used to recover the
# family from a prior FLAG when the case carries one.
_METRIC_FAMILY: dict[str, RuleFamily] = {
    "depth_levels": RuleFamily.LAYERING,
    "cancel_ratio": RuleFamily.SPOOFING,
    "near_fill_cancel_ratio": RuleFamily.SPOOFING,
    "self_match_ratio": RuleFamily.WASH_TRADE,
    "eod_print_move_bps": RuleFamily.MARKING,
}


def _infer_family(case: Case) -> RuleFamily:
    """Recover the manipulation family this case is about.

    Tried in order of decreasing reliability:
      1. an explicit ``features['family']`` the pipeline may record;
      2. the family implied by a prior verdict's cited metric;
      3. the ``Features`` thresholds, in the SAME order ``select_specialist``
         uses, so codification picks the family that was investigated;
      4. default LAYERING (the Beat-B headline evasion).
    """
    features = case.features or {}

    explicit = features.get("family")
    if explicit:
        try:
            return RuleFamily(explicit)
        except ValueError:
            pass

    if case.verdict is not None and case.verdict.cited_metric:
        for key, fam in _METRIC_FAMILY.items():
            if key in case.verdict.cited_metric:
                return fam

    # Mirror specialist_registry triggers / ordering (layering → spoofing →
    # wash → marking) so the codified family matches the recruited specialist.
    if float(features.get("depth_levels", 0)) >= _MIN_LAYERING_DEPTH:
        return RuleFamily.LAYERING
    if float(features.get("cancel_to_fill", 0.0)) > 0.7:
        return RuleFamily.SPOOFING
    if float(features.get("self_match_ratio", 0.0)) > 0.5:
        return RuleFamily.WASH_TRADE
    if bool(features.get("eod_print_spike", False)):
        return RuleFamily.MARKING

    return RuleFamily.LAYERING


def _family_params(
    family: RuleFamily, resolved: ResolvedInputs, features: dict
) -> dict:
    """Build the new rule's params from the debate-resolved contested inputs.

    The contested input the debate sets is ``window_ms`` (the timing the evasion
    stretched). For timing families we widen the rule's own window to that value
    (plus a small slack) so it catches the evasion deterministically — even with
    no resolved override at evaluation time. Thresholds are anchored at the
    regulatory floor and tightened to what THIS case actually showed.
    """
    window = int(getattr(resolved, "window_ms", 0) or 0)

    if family is RuleFamily.LAYERING:
        depth = int(features.get("depth_levels", _MIN_LAYERING_DEPTH))
        return {
            "window_ms": window + _WINDOW_SLACK_MS if window > 0 else 500,
            "min_depth_levels": max(_MIN_LAYERING_DEPTH, depth),
        }
    if family is RuleFamily.SPOOFING:
        return {
            "window_ms": window + _WINDOW_SLACK_MS if window > 0 else 500,
            "min_cancel_ratio": 0.8,
        }
    if family is RuleFamily.WASH_TRADE:
        return {"min_self_match_ratio": 0.5}
    # MARKING
    return {"min_print_move_bps": 100.0}


def derive_rule(
    case: Case, resolved_inputs: ResolvedInputs, confirmed_by: str
) -> Rule:
    """Derive a NEW parameterized rule (correct family) that catches THIS evasion.

    The rule's id encodes its family + provenance so codify is idempotent on a
    given (human, case); provenance records who confirmed it and on what case
    (``human:{confirmed_by}/{case.case_id}``); status is ACTIVE so the next
    ``registry.active()`` includes it.
    """
    family = _infer_family(case)
    params = _family_params(family, resolved_inputs, case.features or {})
    rule_id = f"{family.value}-v2-{case.case_id}"
    return Rule(
        id=rule_id,
        family=family,
        params=params,
        provenance=f"human:{confirmed_by}/{case.case_id}",
        status="ACTIVE",
    )


def regression_gate(
    rule: Rule,
    evasion_events: list[OrderEvent],
    resolved_inputs: ResolvedInputs,
) -> bool:
    """Replay the evasion through a registry INCLUDING ``rule``; True iff it FLAGs.

    The new rule is evaluated first so a pass is attributable to it. The verdict
    is the real deterministic engine's — no LLM grades this. Codification is only
    permitted when this returns True (the codified rule provably closes the gap).
    """
    registry_with_new_rule: list[Rule] = [rule]
    verdict: Verdict = engine.evaluate(
        evasion_events, resolved_inputs, registry_with_new_rule
    )
    return verdict.result == "FLAG"
