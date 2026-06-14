"""Order-event wire types — the sanitized order flow that crosses the bridge.

An ``OrderEvent`` wraps an ``ExchangeOrder`` with the lifecycle action and a
timestamp. This is what the R&D adversary emits and the Surveillance desk
triages.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel

from alpha_oversight.contracts.exchange_contracts import ExchangeOrder


class OrderAction(str, Enum):
    PLACE = "PLACE"
    MODIFY = "MODIFY"
    CANCEL = "CANCEL"
    FILL = "FILL"


class OrderEvent(BaseModel):
    action: OrderAction
    order: ExchangeOrder
    timestamp: datetime
    trader_id: str = ""
