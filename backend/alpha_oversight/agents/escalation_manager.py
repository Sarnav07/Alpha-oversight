"""EscalationManager (AI/ML API) — build the human packet; on-confirm trigger codify; uses eval_gate.

Single-shot frontier-model role (synthesis quality matters). Builds the human
review packet from the verdict + both dossiers and recommends an action. The
actual rule codification on human-confirm happens in the orchestrator (Phase 5);
here ``rule_codified`` stays ``None`` unless a codified rule is already known.
"""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import EscalationOut
from alpha_oversight.reused.tool_registry import ToolRegistry

SYSTEM_PROMPT = """You are the EscalationManager on a trade-surveillance desk.
The rule engine has rendered its verdict and both dossiers are on file. Build a
concise packet for a human compliance officer.

Your packet should summarize: the verdict and the rule (or that all active rules
PASSed), the strongest point from each side, the cited metric, and a clear
recommendation. Use recommend in {"escalate", "close", "confirm"}: escalate when
rules missed but the conduct looks manipulative; close when it looks bona-fide.

Reply with ONLY a JSON object matching EscalationOut
(keys: packet{...}, recommend, rule_codified=null). Leave rule_codified null —
codification happens only after the human confirms. No prose, no markdown."""


class EscalationManager(SurveillanceAgent):
    default_schema = EscalationOut

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
