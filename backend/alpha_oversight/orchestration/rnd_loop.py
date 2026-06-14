"""R&D co-evolution loop [Phase 5] — the adaptive adversary (design §2.2 / §6).

The Adversary (Featherless, MOCKED in tests) proposes an order-event sequence
engineered to evade the CURRENT rule registry. Two *deterministic* oracles judge
it — no LLM renders the verdict:

  - **Oracle-1** = ``rules.engine.evaluate`` MISSes it (verdict ``PASS``): the
    registry does not catch the sequence.
  - **Oracle-2** = ``generators.backtest_adapter.is_profitable_and_moved``: the
    sequence is economically real (P&L>0 AND it moved price).

A sequence that EVADES *and* PROFITS is a **confirmed novel evasion**: it is
handed across the Chinese wall to Surveillance via the ``SanitizedBridge``
(kind=HANDOFF, payload = the events ONLY — never the R&D reasoning), and
returned. Otherwise the loop advances. It is **bounded to K rounds** (design's
termination rule: K rounds, or the first round with no evade-and-profit
sequence), so the demo can never wedge.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Protocol

from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.contracts.case_contracts import AdversaryOut, ResolvedInputs
from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.contracts.rule_contracts import Rule
from alpha_oversight.generators.backtest_adapter import is_profitable_and_moved
from alpha_oversight.rules import engine

if TYPE_CHECKING:
    from alpha_oversight.band.handoff import BandHandoff


class _AdversaryLike(Protocol):
    """The slice of the Adversary agent the loop drives (mock-friendly)."""

    async def run(self, user_prompt: str, schema: type[AdversaryOut] | None = ...) -> AdversaryOut:
        ...


@dataclass
class RnDResult:
    """Outcome of an R&D loop run.

    ``confirmed`` True iff a round produced a sequence that both evaded the
    registry (Oracle-1) and was economically real (Oracle-2); ``events`` carries
    that sequence (the one handed across the wall) and ``rounds`` the number of
    rounds run. On no confirmation after K rounds: ``confirmed=False``,
    ``events=None``, ``rounds==K``.
    """

    confirmed: bool
    events: list[OrderEvent] | None = None
    rounds: int = 0
    params: dict = field(default_factory=dict)


def _as_rule_list(registry_snapshot) -> list[Rule]:
    """Accept a frozen ``list[Rule]`` snapshot or a store exposing ``.active()``.

    R&D reads the registry **read-only**; a snapshot keeps the round's oracle
    stable even if the live registry is codified mid-flight.
    """
    if hasattr(registry_snapshot, "active"):
        return list(registry_snapshot.active())
    return list(registry_snapshot)


def _adversary_brief(rules: list[Rule], round_idx: int, K: int) -> str:
    """A tight market-context + active-rules brief for the adversary's turn."""
    active = ", ".join(f"{r.id}({r.family.value} {r.params})" for r in rules) or "none"
    return (
        f"Round {round_idx}/{K}. Active detection rules to evade: {active}. "
        "Propose an order-event sequence that evades every active rule while "
        "staying economically real (it must move price and extract value)."
    )


async def run_rnd(
    registry_snapshot,
    handoff: "BandHandoff",
    resolved_inputs: ResolvedInputs | None = None,
    K: int = 3,
    seed: int = 0,
    *,
    surveillance_room: str = "case-rnd",
    adversary: _AdversaryLike,
) -> RnDResult:
    """Run the bounded R&D co-evolution loop; return the first confirmed evasion.

    For up to ``K`` rounds the ``adversary`` proposes a ``list[OrderEvent]``; the
    two deterministic oracles judge it. The first sequence that EVADES (Oracle-1
    ``PASS``) and PROFITS (Oracle-2) is crossed to Surveillance via the
    ``SanitizedBridge`` (events only) and returned. If no round qualifies, the
    loop stops at ``K`` with ``confirmed=False`` (bounded — never wedges).

    ``registry_snapshot`` may be a ``list[Rule]`` or a registry store (read
    read-only). ``adversary`` is keyword-only and injected so tests mock it; the
    server wires the real ``agents.adversary.Adversary``.
    """
    rules = _as_rule_list(registry_snapshot)
    resolved = resolved_inputs if resolved_inputs is not None else ResolvedInputs()
    bridge = SanitizedBridge(handoff, surveillance_room)

    rounds = 0
    for round_idx in range(1, max(1, K) + 1):
        rounds = round_idx
        proposal: AdversaryOut = await adversary.run(
            _adversary_brief(rules, round_idx, K), AdversaryOut
        )
        events = proposal.events
        if not events:
            continue  # empty proposal: nothing to judge, advance the round

        # Oracle-1: does the CURRENT registry MISS it? (verdict PASS == evaded)
        evaded = engine.evaluate(events, resolved, rules).result == "PASS"
        # Oracle-2: is it economically real (P&L>0 AND moved price)?
        profitable = is_profitable_and_moved(events, seed=seed)

        if evaded and profitable:
            # Confirmed novel evasion: cross the Chinese wall (events ONLY) + return.
            await bridge.publish_flow(events)
            return RnDResult(
                confirmed=True, events=events, rounds=rounds, params=proposal.params
            )

    return RnDResult(confirmed=False, events=None, rounds=rounds)
