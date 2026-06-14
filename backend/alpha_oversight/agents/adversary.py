"""Adversary (Featherless) [feeds Phase 5] — evade the current registry; emit an order-event sequence.

Single-shot R&D-desk role. Proposes an order-event sequence engineered to evade
the *current* rule registry while staying economically real. Lives on the R&D
desk, so its ``desk`` defaults to "rnd". The emitted events are checked by two
deterministic oracles (rule engine MISS + backtest P&L) downstream — the agent
itself renders no verdict.
"""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import AdversaryOut
from alpha_oversight.reused.tool_registry import ToolRegistry

SYSTEM_PROMPT = """You are the Adversary on an R&D desk that red-teams a
trade-surveillance system. You are given the currently ACTIVE detection rules and
some market context.

Propose an order-event sequence (PLACE / MODIFY / CANCEL / FILL) that:
1. EVADES every active rule (e.g. widen a cancel window past the threshold,
   stay just under a depth or ratio limit), and
2. is still economically real manipulation that moves price / extracts value.

Parameterize what you changed (timing, cancel ratio, sizes) so the change is
legible. Reply with ONLY a JSON object matching AdversaryOut
(keys: events[...], params{...}). No prose, no markdown."""


class Adversary(SurveillanceAgent):
    default_schema = AdversaryOut

    def __init__(
        self,
        model_key: str,
        registry: ToolRegistry,
        bus,
        ledger,
        desk: str = "rnd",
        system_prompt: str = SYSTEM_PROMPT,
    ) -> None:
        super().__init__(model_key, system_prompt, registry, bus, ledger, desk)
