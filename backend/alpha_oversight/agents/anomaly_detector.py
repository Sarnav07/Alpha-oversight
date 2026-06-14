"""AnomalyDetector (Featherless, cheap) — triage the order-flow stream; emit smell+features."""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import AnomalyOut


class AnomalyDetector(SurveillanceAgent):
    async def run(self, user_prompt: str, schema: type = AnomalyOut) -> AnomalyOut:
        raise NotImplementedError
