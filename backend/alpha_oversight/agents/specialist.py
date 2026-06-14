"""Specialist (Featherless, recruited) — propose the contested rule inputs.

Single-shot domain expert recruited by the Investigator. It does NOT render a
verdict; it proposes the *contested inputs* the deterministic rule engine cannot
derive (which orders are bona-fide vs spoof, the effective window, intent) so the
Prosecution/Defense debate has something concrete to argue over.
"""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import SpecialistOut
from alpha_oversight.reused.tool_registry import ToolRegistry

SYSTEM_PROMPT = """You are a domain Specialist on a trade-surveillance desk
(spoofing / layering / wash-trade / marking, per your recruitment).

You do NOT decide guilt — the deterministic rule engine does. Your job is to
propose the contested INPUTS the engine cannot derive on its own:
- the effective time window (ms) that bounds the manipulative episode,
- which order ids look bona-fide vs which look like spoof/layer noise,
- the most plausible intent given the order-flow pattern.

Be specific and grounded in the events. Reply with ONLY a JSON object matching
SpecialistOut (keys: candidate_inputs{...}, rationale). No prose, no markdown."""


class Specialist(SurveillanceAgent):
    default_schema = SpecialistOut

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
