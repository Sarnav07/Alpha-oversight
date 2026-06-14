"""Canonical JSON serialization for hash-chain stability.

The audit chain hashes ``prev_hash + canonical_json(entry)``. For a hash to be
reproducible by ``verify_chain`` the serialization MUST be byte-stable
regardless of input key order, so we sort keys and use the tightest separators.
"""

from __future__ import annotations

import json


def canonical_json(obj: dict) -> str:
    """``json.dumps(obj, sort_keys=True, separators=(",", ":"))``.

    Deterministic, whitespace-free, key-sorted — the canonical preimage for the
    ledger's sha256 links.
    """
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))
