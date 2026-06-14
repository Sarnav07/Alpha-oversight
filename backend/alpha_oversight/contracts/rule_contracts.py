"""Rule + verdict contracts for the deterministic rule engine.

``Rule`` is a frozen dataclass (hashable, snapshot-safe). ``Verdict`` is the
authoritative engine output — PASS or FLAG with the rule that fired and the
metric it cited.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal

from pydantic import BaseModel


class RuleFamily(str, Enum):
    SPOOFING = "spoofing"
    LAYERING = "layering"
    WASH_TRADE = "wash_trade"
    MARKING = "marking"


@dataclass(frozen=True)
class Rule:
    id: str
    family: RuleFamily
    params: dict = field(default_factory=dict)
    provenance: str = ""
    status: str = "ACTIVE"


class Verdict(BaseModel):
    result: Literal["PASS", "FLAG"]
    rule_id: str | None = None
    cited_metric: dict | None = None
