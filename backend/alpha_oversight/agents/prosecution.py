"""Prosecution (AI/ML API frontier, badge) — argue the inputs that maximize the manipulation reading."""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import Dossier


class Prosecution(SurveillanceAgent):
    async def run(self, user_prompt: str, schema: type = Dossier) -> Dossier:
        raise NotImplementedError
