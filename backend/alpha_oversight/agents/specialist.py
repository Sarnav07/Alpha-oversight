"""Specialist (Featherless, recruited) — propose the contested rule inputs."""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import SpecialistOut


class Specialist(SurveillanceAgent):
    async def run(self, user_prompt: str, schema: type = SpecialistOut) -> SpecialistOut:
        raise NotImplementedError
