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
        """Recover the envelope from a Band message body.

        The body is ``"@<mention> " + <json>``. Real Band rewrites the mention to
        the recipient's *display name* (which can contain spaces), so we don't
        split on whitespace — the envelope JSON always begins at the first ``{``,
        so we parse from there. Falls back to the whole string if no brace.
        """
        stripped = content.strip()
        brace = stripped.find("{")
        if brace != -1:
            stripped = stripped[brace:]
        return cls.model_validate(json.loads(stripped))
