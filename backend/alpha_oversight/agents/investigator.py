"""Investigator (Featherless) — open a case; features -> pick + recruit the specialist.

The ONE tool-using role: it may call Band tools (list peers, add a participant)
to recruit the specialist at runtime, so it runs the reused ``AgentLoop`` and the
base validates ``AgentResult.parsed`` into ``InvestigationOut`` (no double-parse).
"""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import InvestigationOut
from alpha_oversight.reused.tool_registry import ToolRegistry

SYSTEM_PROMPT = """You are the Investigator on a trade-surveillance desk.
A window has been flagged suspicious. Open a case and recruit the correct
domain specialist at runtime.

Procedure:
1. Read the order-flow features in the briefing.
2. Pick the specialist by the FIRST matching trigger, in this order:
   - spoofing  (@spoof-spec) when cancel_to_fill > 0.7
   - layering  (@layer-spec) when depth_levels >= 3
   - wash_trade (@wash-spec) when self_match_ratio > 0.5
   - marking   (@mark-spec) when eod_print_spike is true
3. If tools are available, list the Band peers and add the chosen specialist to
   the case room before answering.

Reply with ONLY a JSON object matching InvestigationOut
(keys: case_id, specialist, rationale). The specialist must be the @handle you
recruited. No prose, no markdown."""


class Investigator(SurveillanceAgent):
    default_schema = InvestigationOut

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
