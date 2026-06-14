"""Structured completion — JSON-object call + Pydantic validate-and-repair.

Single-shot agents call this directly. On ValidationError it appends a repair
message carrying ``schema.model_json_schema()`` and retries once, then raises
``StructuredError``.
"""

from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class StructuredError(Exception):
    """Raised when structured_completion can't produce a schema-valid object."""


async def structured_completion(
    messages: list[dict],
    schema: type[T],
    model_key: str,
    max_repair: int = 1,
) -> T:
    raise NotImplementedError
