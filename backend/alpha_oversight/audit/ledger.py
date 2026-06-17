"""Hash-chained audit ledger — the compliance system of record.

Append-only JSONL. Each leaf binds a Band message hash:
``h = sha256((prev_hash + canonical_json(entry)).encode())``. The three fields
the ledger adds to each row — ``band_message_id``, ``prev_hash``, ``hash`` — are
the chain *envelope*, NOT part of the hashed body; ``verify_chain`` strips them
to reconstruct the preimage and recomputes every link, so flipping a single byte
of any payload, forging a ``hash``, or reordering rows all break verification.

A ``db_path`` is accepted to match the frozen interface (design.md keeps a local
SQLite + JSONL pair); for this phase the append-only JSONL is the authoritative,
self-verifying chain.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading

from alpha_oversight.audit.canonical import canonical_json

# Ledger-added envelope fields — excluded from the hashed body.
_ENVELOPE_FIELDS = ("band_message_id", "prev_hash", "hash")


def _hash_link(prev_hash: str, body: str) -> str:
    return hashlib.sha256((prev_hash + body).encode()).hexdigest()


class Ledger:
    def __init__(self, jsonl_path: str, db_path: str):
        self._jsonl_path = jsonl_path
        self._db_path = db_path
        # Serializes the read-modify-write of the chain tail. One shared ledger
        # carries every desk/case, so overlapping appends must not interleave
        # ``head -> hash -> write -> head'`` or they fork ``prev_hash`` off the
        # same tail and ``verify_chain`` falsely reports tamper. A threading lock
        # guards both cooperative (asyncio) and any future to_thread callers; the
        # critical section is pure-CPU + a single file append, so it never blocks
        # on ``await`` and holds the lock only briefly.
        self._lock = threading.Lock()
        os.makedirs(os.path.dirname(os.path.abspath(jsonl_path)), exist_ok=True)
        # Recover the head from any pre-existing file (crash/restart safe).
        self._head = self._read_head_from_file()

    # ── write path ────────────────────────────────────────────────────────────

    def append(self, entry: dict, prev_hash: str) -> str:
        """Append one leaf; return its hash.

        ``body = canonical_json(entry)``; ``h = sha256(prev_hash + body)``; write
        ``{**entry, band_message_id, prev_hash, hash}`` as a JSONL line.

        The whole read-modify-write runs under ``self._lock`` so concurrent cases
        cannot corrupt the chain. To keep the tail consistent when callers race
        (every call site appends ``led.append(entry, led.head())``), the leaf
        chains off the *live* in-memory head sampled inside the lock — the passed
        ``prev_hash`` is honored when it matches that head (the only correct,
        single-writer usage) and is otherwise superseded by the authoritative
        tail so interleaved appends stay a single unbroken chain. This preserves
        the frozen sync signature and is identical for sequential callers, whose
        ``prev_hash`` always equals ``head()``.
        """
        with self._lock:
            # Authoritative tail sampled inside the lock; equals ``prev_hash``
            # for the correct single-writer path, supersedes a stale racing one.
            base = self._head
            body = canonical_json(entry)
            h = _hash_link(base, body)
            record = {
                **entry,
                "band_message_id": entry.get("bmid"),
                "prev_hash": base,
                "hash": h,
            }
            with open(self._jsonl_path, "a", encoding="utf-8") as fh:
                fh.write(canonical_json(record) + "\n")
            self._head = h
            return h

    # ── read path ─────────────────────────────────────────────────────────────

    def head(self) -> str:
        """Last hash; genesis ``""`` if the chain is empty."""
        return self._head

    def _read_head_from_file(self) -> str:
        if not os.path.exists(self._jsonl_path):
            return ""
        last = ""
        with open(self._jsonl_path, "r", encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    last = line
        if not last:
            return ""
        return json.loads(last).get("hash", "")

    # ── verification ────────────────────────────────────────────────────────────

    @staticmethod
    def verify_chain(jsonl_path: str) -> bool:
        """Recompute every link; return ``False`` on any tamper.

        An empty/absent chain is vacuously valid. For each row we strip the
        envelope fields, recompute ``sha256(prev_hash + canonical_json(body))``
        against the stored ``hash``, and require each ``prev_hash`` to equal the
        previous row's ``hash`` (genesis ``""``).
        """
        if not os.path.exists(jsonl_path):
            return True
        prev = ""
        try:
            with open(jsonl_path, "r", encoding="utf-8") as fh:
                for line in fh:
                    if not line.strip():
                        continue
                    record = json.loads(line)
                    stored_hash = record.get("hash")
                    stored_prev = record.get("prev_hash")
                    body = {k: v for k, v in record.items() if k not in _ENVELOPE_FIELDS}
                    recomputed = _hash_link(stored_prev or "", canonical_json(body))
                    if stored_prev != prev or stored_hash != recomputed:
                        return False
                    prev = stored_hash
        except (json.JSONDecodeError, AttributeError, TypeError):
            return False
        return True
