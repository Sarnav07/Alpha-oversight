"""SurveillanceAgent — the shared agent base.

Wraps the reused ``AgentLoop`` with an ``on_action`` -> EventBus + ledger tee and
a final structured-schema parse. Two execution modes, picked by whether the
agent was handed any tools (design §5.8 — **don't double-parse**):

- **Tool-using** roles (Investigator) run the ReAct ``AgentLoop`` and then
  validate ``AgentResult.parsed`` through the schema. The loop already emits one
  ``AgentAction`` per turn via ``on_action``; we tee those to the bus + ledger.
- **Single-shot** roles (AnomalyDetector, Specialist, Prosecution, Defense,
  Adjudicator, EscalationManager, Adversary) call ``structured_completion``
  directly — one Featherless/AIML slot, no loop, no second parse. We synthesise a
  single ``AgentAction`` for the result so the bus + ledger still record the step.

The bus/ledger tee is defensive (tolerates ``None``) so the orchestrator can wire
agents before those collaborators exist; unit tests always supply the conftest
doubles (``FakeEventBus`` / ``FakeLedger``).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, TypeVar

from pydantic import BaseModel, ValidationError

from alpha_oversight.reused.agent_loop import AgentAction, AgentLoop
from alpha_oversight.reused.tool_registry import ToolRegistry
from alpha_oversight.structured import StructuredError, structured_completion

if TYPE_CHECKING:
    from alpha_oversight.audit.ledger import Ledger
    from alpha_oversight.reused.events import ActivityEvent, EventBus

T = TypeVar("T", bound=BaseModel)


class AgentError(Exception):
    """Raised when an agent cannot produce a schema-valid result."""


class SurveillanceAgent:
    def __init__(
        self,
        model_key: str,
        system_prompt: str,
        registry: ToolRegistry,
        bus: "EventBus | None",
        ledger: "Ledger | None",
        desk: str,
    ) -> None:
        self._model_key = model_key
        self._system_prompt = system_prompt
        self._registry = registry
        self._bus = bus
        self._ledger = ledger
        self._desk = desk

    # Subclasses set this so ``run`` works when ``schema`` is omitted.
    default_schema: type[BaseModel] | None = None

    @property
    def name(self) -> str:
        """Stable agent name for events / ledger (the wrapper class name)."""
        return type(self).__name__

    async def run(self, user_prompt: str, schema: type[T] | None = None) -> T:
        """Run the agent and return a validated instance of ``schema``.

        Tool-using agents (registry has tools) run the loop then validate
        ``AgentResult.parsed``; single-shot agents call ``structured_completion``
        directly. Never both on one call.
        """
        schema = schema or self.default_schema
        if schema is None:  # pragma: no cover - wrappers always set a default
            raise AgentError(f"{self.name}: no output schema provided")

        if self._registry.has_tools():
            return await self._run_with_tools(user_prompt, schema)
        return await self._run_single_shot(user_prompt, schema)

    # ── tool-using path ──────────────────────────────────────────────────────

    async def _run_with_tools(self, user_prompt: str, schema: type[T]) -> T:
        loop = AgentLoop(
            model_key=self._model_key,
            system_prompt=self._system_prompt,
            tool_registry=self._registry,
            on_action=self._emit,
        )
        result = await loop.run_turn(user_prompt)
        if result.parsed is None:
            raise AgentError(
                f"{self.name}: agent loop produced no parseable JSON "
                f"(raw={result.raw_text[:200]!r})"
            )
        try:
            return schema.model_validate(result.parsed)
        except ValidationError as err:
            raise AgentError(
                f"{self.name}: loop output failed {schema.__name__} validation: {err}"
            ) from err

    # ── single-shot path ─────────────────────────────────────────────────────

    async def _run_single_shot(self, user_prompt: str, schema: type[T]) -> T:
        messages = [
            {"role": "system", "content": self._system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        try:
            out = await structured_completion(messages, schema, self._model_key)
        except StructuredError as err:
            raise AgentError(f"{self.name}: {err}") from err

        # The loop's on_action never fires for this path, so emit one synthetic
        # action carrying the structured result -> bus + ledger record the step.
        await self._emit(
            AgentAction(
                turn_number=1,
                role="assistant",
                content=out.model_dump_json(),
            )
        )
        return out

    # ── tee: AgentAction -> EventBus + hash-chained ledger ───────────────────

    async def _emit(self, action: AgentAction) -> None:
        """Publish one trace step to the EventBus and append it to the ledger.

        Errors in the tee are swallowed so a flaky bus/ledger can never wedge an
        agent mid-turn (parity with ``AgentLoop._emit_action``).
        """
        event = self._to_event(action)
        if self._bus is not None:
            try:
                await self._bus.publish(event)
            except Exception:  # pragma: no cover - defensive
                pass
        if self._ledger is not None:
            try:
                body = json.dumps(event, sort_keys=True, separators=(",", ":"))
                entry = {
                    "agent": self.name,
                    "desk": self._desk,
                    "role": action.role,
                    "content_sha256": hashlib.sha256(body.encode()).hexdigest(),
                }
                self._ledger.append(entry, self._ledger.head())
            except Exception:  # pragma: no cover - defensive
                pass

    def _to_event(self, action: AgentAction) -> "ActivityEvent":
        tool_calls: list[dict] = []
        if action.tool_name:
            tool_calls = [
                {
                    "name": action.tool_name,
                    "id": action.tool_call_id,
                    "arguments": action.input_json,
                    "result": action.output_json,
                }
            ]
        event: dict[str, Any] = {
            "agent_name": self.name,
            "model_id": self._model_key,
            "desk": self._desk,
            "content": action.content,
            "reasoning": action.reasoning,
            "tool_calls": tool_calls,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return event  # type: ignore[return-value]
