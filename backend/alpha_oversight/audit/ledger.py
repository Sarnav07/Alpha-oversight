"""Hash-chained audit ledger — the compliance system of record.

Append-only JSONL + SQLite. Each leaf binds a Band message hash:
``h = sha256((prev_hash + canonical_json(entry)).encode())``. ``verify_chain``
recomputes every link — tamper-evident.
"""

from __future__ import annotations


class Ledger:
    def __init__(self, jsonl_path: str, db_path: str):
        self._jsonl_path = jsonl_path
        self._db_path = db_path
        raise NotImplementedError

    def append(self, entry: dict, prev_hash: str) -> str:
        """body=canonical_json(entry); h=sha256(prev_hash+body); write {**entry,bmid,prev_hash,hash}; return h."""
        raise NotImplementedError

    def head(self) -> str:
        """Last hash; genesis ``""`` if empty."""
        raise NotImplementedError

    @staticmethod
    def verify_chain(jsonl_path: str) -> bool:
        """Recompute every link; returns False on any tamper."""
        raise NotImplementedError
