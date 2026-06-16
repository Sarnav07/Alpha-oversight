"""Adjudicator (1 cheap LLM call) — pick the contested-input values from the debate.

Single-shot and thin: reads the Prosecution and Defense dossiers and resolves the
contested inputs into the concrete values the deterministic rule engine consumes
(``ResolvedInputs``). One cheap call, then the engine — not the LLM — renders the
verdict.
"""

from __future__ import annotations

from alpha_oversight.agents.base_agent import SurveillanceAgent
from alpha_oversight.contracts.case_contracts import ResolvedInputs
from alpha_oversight.reused.tool_registry import ToolRegistry

SYSTEM_PROMPT = """You are the Adjudicator on a trade-surveillance desk.
You are given the Prosecution and Defense dossiers, each claiming a set of
contested inputs. Resolve them into a single concrete set the rule engine can
evaluate:
- window_ms: the episode window in milliseconds — but ONLY when the contested
  orders form a single tight burst. Set window_ms to the narrowest contiguous
  cluster the evidence STRICTLY supports. If the contested orders are spread out
  (a slow drip rather than one burst), resolve window_ms = 0, which defers to the
  standing rule's own threshold. You must NEVER widen a detection window to make a
  pattern trip — broadening a rule to catch a slower pattern is a HUMAN
  codification decision, not yours. When the timing is contested or ambiguous,
  resolve conservatively (narrower / 0), giving the trader the benefit of the doubt.
- bona_fide_ids: the order ids you judge genuinely bona-fide,
- intent: a one-line characterization of the most defensible intent.

Weigh the evidence both sides cite; do not simply average. You do NOT decide
PASS/FLAG — the engine does that from your resolved inputs. Reply with ONLY a
JSON object matching ResolvedInputs (keys: window_ms, bona_fide_ids, intent).
No prose, no markdown."""


class Adjudicator(SurveillanceAgent):
    default_schema = ResolvedInputs

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
