"""Prompt briefs for the surveillance choreography (legible, schema-anchored).

Each brief is a tight, on-screen-legible user turn for one stage's agent. They
live apart from ``surveillance_pipeline`` so the orchestrator stays focused on
control flow. Briefs reference the order-flow / debate artifacts the stage owns;
the strict output contract is the agent's own system prompt + schema.
"""

from __future__ import annotations

from alpha_oversight.contracts.case_contracts import Dossier, Features, SpecialistOut
from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.contracts.rule_contracts import Verdict


def flow_brief(events: list[OrderEvent], features: "Features | None" = None) -> str:
    """Triage brief for the AnomalyDetector.

    Includes the deterministically-computed features (authoritative) AND a compact
    per-order table so the LLM judges ``suspicious`` over real numbers instead of
    guessing from a bare event count. ``features`` is computed when not supplied.
    """
    from alpha_oversight.rules.features import compute_features

    f = features if features is not None else compute_features(events)
    n = len(events)
    actions = sorted({ev.action.value for ev in events})
    symbols = sorted({ev.order.symbol for ev in events})

    rows = []
    for ev in events[:24]:
        o = ev.order
        px = getattr(o, "limit_price", None)
        rows.append(
            f"  {ev.action.value:6} {o.side.value:4} qty={o.quantity} "
            f"px={px} trader={ev.trader_id}"
        )
    if len(events) > 24:
        rows.append(f"  … (+{len(events) - 24} more)")
    table = "\n".join(rows)

    return (
        f"Triage this order-flow window: {n} events ({', '.join(actions)}) on "
        f"{', '.join(symbols)}.\n"
        "Deterministically computed features (authoritative — report these "
        "verbatim): "
        f"cancel_to_fill={f.cancel_to_fill:.2f}, depth_levels={f.depth_levels}, "
        f"self_match_ratio={f.self_match_ratio:.2f}, "
        f"eod_print_spike={str(f.eod_print_spike).lower()}.\n"
        f"Order events:\n{table}\n"
        "Decide `suspicious` (true if any feature is clearly abnormal) and report "
        "the four Features exactly as given above."
    )


def investigation_brief(case_id: str, features: Features) -> str:
    return (
        f"Open case {case_id}. Order-flow features: {features.model_dump()}. "
        "Pick the specialist by the first matching trigger and recruit it."
    )


def specialist_brief(family: str, features: Features) -> str:
    return (
        f"You are the {family} specialist. Features: {features.model_dump()}. "
        "Propose the contested inputs (window_ms, bona_fide ids, intent)."
    )


def debate_brief(
    side: str, family: str, spec_out: SpecialistOut, rebuttal: Dossier | None
) -> str:
    base = (
        f"Case family: {family}. Specialist candidate inputs: "
        f"{spec_out.candidate_inputs}."
    )
    if rebuttal is not None:
        base += f" Opposing argument to rebut: {rebuttal.headline}"
    return base + f" Argue the {side} reading of the contested inputs."


def adjudication_brief(pro: Dossier | None, dfn: Dossier | None) -> str:
    return (
        "Resolve the contested inputs. "
        f"Prosecution: {pro.headline if pro else 'n/a'} | "
        f"claimed={pro.claimed_inputs if pro else {}}. "
        f"Defense: {dfn.headline if dfn else 'n/a'} | "
        f"claimed={dfn.claimed_inputs if dfn else {}}."
    )


def escalation_brief(verdict: Verdict, pro: Dossier | None, dfn: Dossier | None) -> str:
    return (
        f"Verdict: {verdict.result} (rule={verdict.rule_id}, "
        f"metric={verdict.cited_metric}). "
        f"Prosecution: {pro.headline if pro else 'n/a'}. "
        f"Defense: {dfn.headline if dfn else 'n/a'}. "
        "Build the human packet and recommend an action."
    )
