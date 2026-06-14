"""SurveillanceAgent — the shared agent base.

Wraps the reused AgentLoop with an on_action -> EventBus tee and a final
structured-schema parse. Tool-using agents run the loop then validate
``AgentResult.parsed``; single-shot agents go straight through
``structured_completion`` (see §5.8 — don't double-parse).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypeVar

from pydantic import BaseModel

from alpha_oversight.reused.tool_registry import ToolRegistry

if TYPE_CHECKING:
    from alpha_oversight.audit.ledger import Ledger
    from alpha_oversight.reused.events import EventBus

T = TypeVar("T", bound=BaseModel)


class SurveillanceAgent:
    def __init__(
        self,
        model_key: str,
        system_prompt: str,
        registry: ToolRegistry,
        bus: "EventBus",
        ledger: "Ledger",
        desk: str,
    ) -> None:
        self._model_key = model_key
        self._system_prompt = system_prompt
        self._registry = registry
        self._bus = bus
        self._ledger = ledger
        self._desk = desk

    async def run(self, user_prompt: str, schema: type[T]) -> T:
        raise NotImplementedError
