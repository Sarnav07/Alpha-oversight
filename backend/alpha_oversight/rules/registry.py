"""SQLite-backed rule registry — the shared, R/O-to-R&D rule set.

Holds ACTIVE detection rules. ``codify`` INSERTs a new human-confirmed rule
live (the demo's wow moment); ``active`` returns the current rule set the
engine evaluates against.
"""

from __future__ import annotations

from alpha_oversight.contracts.rule_contracts import Rule


class RuleRegistryStore:
    def __init__(self, db_path: str):
        self._db_path = db_path
        raise NotImplementedError

    def active(self) -> list[Rule]:
        raise NotImplementedError

    def codify(self, rule: Rule) -> None:
        """INSERT a rule with status ACTIVE."""
        raise NotImplementedError

    def count(self) -> int:
        raise NotImplementedError
