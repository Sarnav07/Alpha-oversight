"""Structured completion — JSON-object call + Pydantic validate-and-repair.

Single-shot agents call this directly. On ValidationError it appends a repair
message carrying ``schema.model_json_schema()`` and retries once, then raises
``StructuredError``.
"""

from __future__ import annotations

import json
from typing import TypeVar

import litellm
from pydantic import BaseModel, ValidationError

from alpha_oversight import providers
from alpha_oversight.reused.gateway import MODELS

T = TypeVar("T", bound=BaseModel)


class StructuredError(Exception):
    """Raised when structured_completion can't produce a schema-valid object."""


def _repair_message(schema: type[BaseModel], raw_text: str, err: ValidationError) -> dict:
    """A user turn that hands the model its schema + the validation errors."""
    return {
        "role": "user",
        "content": (
            "Your previous reply did not satisfy the required schema. "
            "Return ONLY a single JSON object matching this JSON Schema:\n"
            f"{json.dumps(schema.model_json_schema())}\n\n"
            f"Validation errors: {err.errors()}\n"
            "No markdown, no prose outside the JSON object."
        ),
    }


async def structured_completion(
    messages: list[dict],
    schema: type[T],
    model_key: str,
    max_repair: int = 1,
) -> T:
    """JSON-object completion validated into ``schema``, with bounded repair.

    Makes a ``response_format={"type":"json_object"}`` litellm call, validates the
    returned text with ``schema.model_validate_json``. On ``ValidationError`` it
    appends one repair turn (carrying ``schema.model_json_schema()``) and retries,
    up to ``max_repair`` extra attempts, then raises ``StructuredError``.
    Featherless calls take a ``FEATHERLESS_SEMAPHORE`` slot.
    """
    spec = MODELS.get(model_key)
    if spec is None:
        raise StructuredError(f"Unknown model: {model_key}")

    call_kwargs = providers.resolve_call_kwargs(spec)
    featherless = providers.is_featherless(spec)
    convo = list(messages)
    last_err: Exception | None = None

    for _ in range(max_repair + 1):  # 1 initial attempt + max_repair repairs
        async def _do_call() -> str:
            response = await litellm.acompletion(
                model=spec.litellm_model,
                messages=convo,
                max_tokens=spec.max_tokens,
                temperature=spec.temperature,
                response_format={"type": "json_object"},
                **call_kwargs,
            )
            return response.choices[0].message.content or ""

        if featherless:
            async with providers.FEATHERLESS_SEMAPHORE:
                raw_text = await _do_call()
        else:
            raw_text = await _do_call()

        try:
            return schema.model_validate_json(raw_text)
        except ValidationError as err:
            last_err = err
            convo = [*convo, {"role": "assistant", "content": raw_text},
                     _repair_message(schema, raw_text, err)]

    raise StructuredError(
        f"structured_completion failed for {model_key} after {max_repair} repair(s): {last_err}"
    )
