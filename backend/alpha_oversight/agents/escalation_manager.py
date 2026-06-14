"""EscalationManager (AI/ML API) — build the human packet; on-confirm trigger codify; uses eval_gate."""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import EscalationOut


class EscalationManager(SurveillanceAgent):
    async def run(self, user_prompt: str, schema: type = EscalationOut) -> EscalationOut:
        raise NotImplementedError
