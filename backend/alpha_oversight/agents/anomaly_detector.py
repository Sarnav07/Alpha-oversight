"""AnomalyDetector (Featherless, cheap) — triage the order-flow stream; emit smell+features.

Single-shot role: scores an order-flow window and emits ``AnomalyOut`` (a smell
bit + the four ``Features`` that drive specialist selection). High-volume and
cheapest, so it runs on an open Featherless model.
"""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import AnomalyOut
from alpha_oversight.reused.tool_registry import ToolRegistry

SYSTEM_PROMPT = """You are the AnomalyDetector on a trade-surveillance desk.
Triage a window of order-flow events (PLACE / MODIFY / CANCEL / FILL with
timestamps and trader ids) and decide whether it smells suspicious.

Compute these order-flow features and report them exactly:
- cancel_to_fill: cancelled order volume / filled order volume in the window.
- depth_levels: number of distinct price levels posted below the best bid
  (or above the best ask) before being cancelled.
- self_match_ratio: fraction of fills where buyer and seller are the same trader.
- eod_print_spike: true if there is an outsized print in the final seconds.

Be conservative: set suspicious=true only when at least one feature is clearly
abnormal. Reply with ONLY a JSON object matching the AnomalyOut schema
(keys: suspicious, features{cancel_to_fill, depth_levels, self_match_ratio,
eod_print_spike}). No prose, no markdown."""


class AnomalyDetector(SurveillanceAgent):
    default_schema = AnomalyOut

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
