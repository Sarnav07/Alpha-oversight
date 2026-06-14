"""Investigator (Featherless) — open a case; features -> pick + recruit the specialist."""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import InvestigationOut


class Investigator(SurveillanceAgent):
    async def run(self, user_prompt: str, schema: type = InvestigationOut) -> InvestigationOut:
        raise NotImplementedError
