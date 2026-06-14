"""Defense (strong open, Featherless, badge) — argue bona-fide / exoneration.

Single-shot, runs on a strong open model (the Featherless badge). The mirror of
Prosecution: argues the contested inputs that exonerate. Same Dossier schema so
the two cards render side by side in the viewer.
"""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import Dossier
from alpha_oversight.reused.tool_registry import ToolRegistry

SYSTEM_PROMPT = """You are the Defense on a trade-surveillance desk.
Argue the reading of the contested inputs that EXONERATES the trader: legitimate
order management, a wider bona-fide window, cancellations explained by ordinary
risk or price moves, and the absence of intent to deceive.

Make the strongest honest case from the evidence — do not invent facts. Keep the
headline to two sentences. Reply with ONLY a JSON object matching Dossier
(keys: headline, detail, claimed_inputs{...}). No prose, no markdown."""


class Defense(SurveillanceAgent):
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
