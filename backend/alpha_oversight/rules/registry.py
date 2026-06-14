"""SQLite-backed rule registry — the shared, R/O-to-R&D rule set.

Holds ACTIVE detection rules. ``codify`` INSERTs a new human-confirmed rule
live (the demo's wow moment); ``active`` returns the current rule set the
engine evaluates against.

Sync ``sqlite3`` on purpose: the section-2 signatures are synchronous and the
store is read at engine time (no event loop). ``params`` is JSON-serialized in a
TEXT column; ``family`` is stored as its enum value. The table is created on
construct, so a fresh handle on an existing db sees prior rows (persistence).
"""

from __future__ import annotations

import json
import sqlite3

from alpha_oversight.contracts.rule_contracts import Rule, RuleFamily

_SCHEMA = """
CREATE TABLE IF NOT EXISTS rules (
    id          TEXT PRIMARY KEY,
    family      TEXT NOT NULL,
    params      TEXT NOT NULL,
    provenance  TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'ACTIVE'
)
"""


class RuleRegistryStore:
    def __init__(self, db_path: str):
        self._db_path = db_path
        with self._connect() as conn:
            conn.execute(_SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def active(self) -> list[Rule]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, family, params, provenance, status "
                "FROM rules WHERE status = 'ACTIVE' ORDER BY id"
            ).fetchall()
        return [
            Rule(
                id=row["id"],
                family=RuleFamily(row["family"]),
                params=json.loads(row["params"]),
                provenance=row["provenance"],
                status=row["status"],
            )
            for row in rows
        ]

    def codify(self, rule: Rule) -> None:
        """INSERT a rule with status ACTIVE (idempotent on id)."""
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO rules "
                "(id, family, params, provenance, status) VALUES (?, ?, ?, ?, ?)",
                (
                    rule.id,
                    rule.family.value,
                    json.dumps(rule.params, sort_keys=True),
                    rule.provenance,
                    "ACTIVE",
                ),
            )
            conn.commit()

    def count(self) -> int:
        with self._connect() as conn:
            (n,) = conn.execute("SELECT COUNT(*) FROM rules").fetchone()
        return int(n)
