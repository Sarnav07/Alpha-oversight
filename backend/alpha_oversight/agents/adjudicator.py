"""Adjudicator (1 cheap LLM call) — pick the contested-input values from the debate."""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import ResolvedInputs


class Adjudicator(SurveillanceAgent):
    async def run(self, user_prompt: str, schema: type = ResolvedInputs) -> ResolvedInputs:
        raise NotImplementedError
