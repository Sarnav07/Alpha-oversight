# LIFTED FROM trader-arena/arena/agent/tools/base.py:1 — verbatim (dataclass ToolResult, NOT Pydantic).
"""Tool infrastructure — definitions, results, and registry.

OpenAI function-calling format. Framework-agnostic. The AgentLoop reads
``result.success`` / ``result.data`` / ``result.error`` directly, so this
dataclass version is load-bearing — do NOT substitute a Pydantic toolkit.
"""

import logging
from dataclasses import dataclass
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


@dataclass
class ToolDefinition:
    """Single tool in OpenAI function-calling format."""

    name: str
    description: str
    parameters: dict[str, Any]

    def to_dict(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


@dataclass
class ToolResult:
    """Result from executing a tool."""

    success: bool
    data: str
    error: str | None = None


@dataclass
class ExecResult:
    """Result from a Docker exec command."""

    exit_code: int
    stdout: str
    stderr: str


class ToolRegistry:
    """Maps tool names to executors. Thread-safe for async use."""

    def __init__(self) -> None:
        self._executors: dict[str, Callable[..., Awaitable[ToolResult]]] = {}
        self._definitions: list[ToolDefinition] = []

    def register(self, defn: ToolDefinition, executor: Callable[..., Awaitable[ToolResult]]) -> None:
        self._executors[defn.name] = executor
        self._definitions.append(defn)

    def definitions(self) -> list[dict]:
        return [d.to_dict() for d in self._definitions]

    def has_tools(self) -> bool:
        return len(self._definitions) > 0

    async def execute(self, name: str, args: dict) -> ToolResult:
        executor = self._executors.get(name)
        if executor is None:
            return ToolResult(success=False, data="", error=f"Unknown tool: {name}")
        try:
            return await executor(args)
        except Exception as e:
            logger.exception(f"Tool {name} failed: {e}")
            return ToolResult(success=False, data="", error=str(e))
