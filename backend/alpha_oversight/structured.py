"""Structured completion — JSON-object call + Pydantic validate-and-repair.

Single-shot agents call this directly. On ValidationError it appends a repair
message carrying ``schema.model_json_schema()`` and retries once, then raises
``StructuredError``. On a *transient* API error (notably Featherless's $25-plan
cap of 4 model-switches/minute) it backs off and retries the network call so the
case slows rather than fails.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
from typing import TypeVar

import litellm
from pydantic import BaseModel, ValidationError

from alpha_oversight import providers
from alpha_oversight.reused.gateway import MODELS

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def _strip_fences(text: str) -> str:
    """Strip markdown code fences some models wrap JSON in (e.g. ```json ... ```)."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]  # drop opening fence line
        if text.endswith("```"):
            text = text[: text.rfind("```")]
    return text.strip()


# Transient API failures worth retrying with backoff (vs. a permanent 400/auth
# error, which we let propagate untouched). RateLimitError is the important one:
# Featherless caps model-SWITCHING at 4/minute on the $25 plan and the courtroom
# seats each run a different family, so a hot run can trip it — we wait the rolling
# window out instead of failing the case. Built defensively so a model name that a
# given litellm version doesn't export can't crash import.
_TRANSIENT: tuple[type[BaseException], ...] = tuple(
    cls
    for cls in (
        getattr(litellm, name, None)
        for name in (
            "RateLimitError", "APIConnectionError",
            "ServiceUnavailableError", "InternalServerError",
        )
    )
    if isinstance(cls, type)
)
_RATE_LIMIT = getattr(litellm, "RateLimitError", None)

# Hard per-call ceiling. Featherless loads these big open models on-demand, so a
# COLD call can take minutes; this bounds a truly hung call. A timeout is NOT in
# _TRANSIENT (a hung/cold model won't recover on a blind retry), so it fails the
# call instead of looping. Warm calls return in seconds — pre-warm the models for
# a snappy demo. Tunable via env.
_CALL_TIMEOUT = float(os.environ.get("LLM_CALL_TIMEOUT", "600"))


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


async def _call_once(spec, convo: list[dict], call_kwargs: dict) -> str:
    response = await litellm.acompletion(
        model=spec.litellm_model,
        messages=convo,
        max_tokens=spec.max_tokens,
        temperature=spec.temperature,
        response_format={"type": "json_object"},
        timeout=_CALL_TIMEOUT,
        **call_kwargs,
    )
    return response.choices[0].message.content or ""


async def _call_with_backoff(
    spec, convo: list[dict], call_kwargs: dict, featherless: bool, retries: int = 4
) -> str:
    """One LLM call, retrying transient API errors with backoff.

    The Featherless semaphore is taken PER attempt, so the slot is released during
    the backoff sleep (never held while we wait out a rate-limit window). Permanent
    errors (400/401/…) are not in ``_TRANSIENT`` and propagate on the first try.
    """
    last: BaseException | None = None
    for attempt in range(retries + 1):
        try:
            if featherless:
                async with providers.featherless_semaphore(spec):
                    return await _call_once(spec, convo, call_kwargs)
            return await _call_once(spec, convo, call_kwargs)
        except _TRANSIENT as e:  # type: ignore[misc]
            last = e
            if attempt >= retries:
                raise
            # Rate limits clear as the rolling minute ages — wait it out (~20/40/60/80s).
            # Other transients (timeout, 5xx, conn reset) get a short exponential backoff.
            if _RATE_LIMIT is not None and isinstance(e, _RATE_LIMIT):
                wait = 20.0 * (attempt + 1) + random.uniform(0, 5)
            else:
                wait = 2.0 ** attempt + random.uniform(0, 1)
            logger.warning(
                "structured_completion transient error on %s (attempt %d/%d): %s — retrying in %.1fs",
                spec.litellm_model, attempt + 1, retries, type(e).__name__, wait,
            )
            await asyncio.sleep(wait)
    raise last  # pragma: no cover - loop above always returns or raises


async def structured_completion(
    messages: list[dict],
    schema: type[T],
    model_key: str,
    max_repair: int = 1,
) -> T:
    """JSON-object completion validated into ``schema``, with bounded repair.

    Makes a ``response_format={"type":"json_object"}`` litellm call (with transient
    backoff — see ``_call_with_backoff``), validates the returned text with
    ``schema.model_validate_json``. On ``ValidationError`` it appends one repair turn
    (carrying ``schema.model_json_schema()``) and retries, up to ``max_repair`` extra
    attempts, then raises ``StructuredError``. Featherless calls take a
    ``FEATHERLESS_SEMAPHORE`` slot.
    """
    spec = MODELS.get(model_key)
    if spec is None:
        raise StructuredError(f"Unknown model: {model_key}")

    call_kwargs = providers.resolve_call_kwargs(spec)
    featherless = providers.is_featherless(spec)
    convo = list(messages)
    last_err: Exception | None = None

    for _ in range(max_repair + 1):  # 1 initial attempt + max_repair repairs
        raw_text = await _call_with_backoff(spec, convo, call_kwargs, featherless)

        try:
            return schema.model_validate_json(_strip_fences(raw_text))
        except ValidationError as err:
            last_err = err
            convo = [*convo, {"role": "assistant", "content": raw_text},
                     _repair_message(schema, raw_text, err)]

    raise StructuredError(
        f"structured_completion failed for {model_key} after {max_repair} repair(s): {last_err}"
    )
