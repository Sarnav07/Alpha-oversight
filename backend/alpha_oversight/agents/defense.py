"""Defense (strong open, Featherless, badge) — argue bona-fide / exoneration."""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import Dossier


class Defense(SurveillanceAgent):
    async def run(self, user_prompt: str, schema: type = Dossier) -> Dossier:
        raise NotImplementedError
