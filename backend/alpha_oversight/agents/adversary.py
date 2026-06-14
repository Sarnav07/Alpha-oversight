"""Adversary (Featherless) [feeds Phase 5] — evade the current registry; emit an order-event sequence."""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import AdversaryOut


class Adversary(SurveillanceAgent):
    async def run(self, user_prompt: str, schema: type = AdversaryOut) -> AdversaryOut:
        raise NotImplementedError
