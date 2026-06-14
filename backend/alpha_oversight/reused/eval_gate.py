# LIFTED FROM info-biz-arena/src/arena/eval/scorecard.py — EXTRACTED _eval_completion + fence-strip + GRADE_THRESHOLDS.
# STRIPPED: log_expense/structlog side-effects + all info-biz rubric strings. Used by EscalationManager.
"""Minimal LLM-eval helper for the EscalationManager quality gate.

Provides:
- ``_eval_completion`` — a thin ``litellm.acompletion`` wrapper (no expense
  logging coupling).
- ``strip_json_fences`` — the markdown ```json fence stripper.
- ``GRADE_THRESHOLDS`` / ``grade_for`` — threshold → letter-grade mapping.

The escalation rubric strings are NOT carried over; the EscalationManager will
supply its own system/rubric prompt in a later phase.
"""

from __future__ import annotations

import json
import re

import litellm


async def _eval_completion(**kwargs):
    """Thin wrapper around ``litellm.acompletion`` for eval/gate calls.

    Kept as a seam so the EscalationManager's gate call is mockable and so
    Phase-1B can inject ``providers.resolve_call_kwargs`` here too.
    """
    # TODO(Phase-1B): kwargs.update(providers.resolve_call_kwargs(spec)) for non-OpenRouter routing.
    return await litellm.acompletion(**kwargs)


def strip_json_fences(text: str) -> str:
    """Strip a leading/trailing markdown ```json fence, if present."""
    json_text = (text or "").strip()
    if json_text.startswith("```"):
        json_text = re.sub(r"^```(?:json)?\s*", "", json_text)
        json_text = re.sub(r"\s*```$", "", json_text)
    return json_text


def parse_json_response(text: str) -> dict:
    """Strip fences then ``json.loads``. Raises ``json.JSONDecodeError`` on bad JSON."""
    return json.loads(strip_json_fences(text))


# Threshold → letter grade. Scores are summed across rubric dimensions.
GRADE_THRESHOLDS: list[tuple[int, str]] = [
    (17, "A"),
    (12, "B"),
    (7, "C"),
    (0, "D"),
]


def grade_for(total: int) -> str:
    """Return the letter grade for a total score using ``GRADE_THRESHOLDS``."""
    grade = "D"
    for threshold, label in GRADE_THRESHOLDS:
        if total >= threshold:
            grade = label
            break
    return grade
