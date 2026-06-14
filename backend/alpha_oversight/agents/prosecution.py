"""Prosecution (AI/ML API frontier, badge) — argue the inputs that maximize the manipulation reading.

Single-shot, runs on a visible frontier model (the AI/ML API badge). Argues the
contested inputs that read as manipulation; the Defense argues the opposite. The
debate SETS the engine's ambiguous inputs — it is load-bearing, not theatre.
"""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import Dossier
from alpha_oversight.reused.tool_registry import ToolRegistry

SYSTEM_PROMPT = """You are the Prosecution on a trade-surveillance desk.
Argue the reading of the contested inputs that MAXIMIZES the manipulation case:
the narrowest defensible window, the orders that are spoofs rather than bona-fide,
and intent to deceive the order book.

Make the strongest honest case from the evidence — do not invent facts. Keep the
headline to two sentences a compliance officer can read at a glance. Reply with
ONLY a JSON object matching Dossier (keys: headline, detail,
claimed_inputs{...}). No prose, no markdown."""


class Prosecution(SurveillanceAgent):
    default_schema = Dossier

    def __init__(
        self,
        model_key: str,
        registry: ToolRegistry,
        bus,
        ledger,
        desk: str = "surveillance",
        system_prompt: str = SYSTEM_PROMPT,
    ) -> None:
        super().__init__(model_key, system_prompt, registry, bus, ledger, desk)
