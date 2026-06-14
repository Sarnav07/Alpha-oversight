"""Band message envelope — the JSON-in-@mention artifact of record.

Every cross-desk handoff rides inside a Band message body as an ``Envelope``.
The ledger stores ``sha256(content)``; ``case_id`` == Band room ``task_id``.
``from`` is a Python keyword, so the field is ``from_`` with a ``from`` alias.
"""

from __future__ import annotations

import json
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class BandKind(str, Enum):
    HANDOFF = "handoff"
    EVIDENCE = "evidence"
    VERDICT = "verdict"
    ESCALATION = "escalation"
    RULE_CODIFIED = "rule_codified"


class Envelope(BaseModel):
    v: int = 1
    msg_id: str = Field(default_factory=lambda: str(uuid4()))
    case_id: str
    from_: str = Field(alias="from")
    to: str
    kind: BandKind
    payload: dict

    model_config = ConfigDict(populate_by_name=True)

    def to_mention(self) -> str:
        """``f"@{to} " + <json with by_alias>`` — the message content put on the wire."""
        return f"@{self.to} " + self.model_dump_json(by_alias=True)

    @classmethod
    def parse_mention(cls, content: str) -> "Envelope":
        """Strip a leading ``@handle`` token, then ``json.loads`` the remainder."""
        stripped = content.strip()
        if stripped.startswith("@"):
            # Drop the leading "@handle " mention token.
            parts = stripped.split(None, 1)
            stripped = parts[1] if len(parts) == 2 else ""
        return cls.model_validate(json.loads(stripped))
