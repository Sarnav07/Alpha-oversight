"""Canonical JSON serialization for hash-chain stability."""

from __future__ import annotations


def canonical_json(obj: dict) -> str:
    """``json.dumps(obj, sort_keys=True, separators=(",", ":"))``."""
    raise NotImplementedError
