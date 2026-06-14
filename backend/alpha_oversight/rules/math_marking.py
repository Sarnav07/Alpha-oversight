"""marking family metric (Phase-1A implementation).

Pure deterministic math over the order-event sequence. Returns
(tripped, cited_metric); the engine wraps it into a Verdict.
"""

from __future__ import annotations

from alpha_oversight.contracts.order_events import OrderEvent


def metric(events: list[OrderEvent], params: dict) -> tuple[bool, dict]:
    raise NotImplementedError
