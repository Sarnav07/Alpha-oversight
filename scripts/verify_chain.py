#!/usr/bin/env python3
"""CLI: verify a hash-chained audit ledger JSONL is tamper-free.

    python scripts/verify_chain.py data/ledger/ledger.jsonl

Exit code 0 = chain verifies (or is empty); 1 = tampered / unreadable. This is
the demo + CI gate behind design.md's "verify_chain() is demonstrable".
"""

from __future__ import annotations

import os
import sys

# Allow running without an editable install: add backend/ to sys.path.
_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
if os.path.isdir(_BACKEND):
    sys.path.insert(0, os.path.abspath(_BACKEND))

from alpha_oversight.audit.ledger import Ledger  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: verify_chain.py <ledger.jsonl>", file=sys.stderr)
        return 2
    path = argv[1]
    if not os.path.exists(path):
        print(f"verify_chain: FAIL — no such file: {path}", file=sys.stderr)
        return 1
    ok = Ledger.verify_chain(path)
    if ok:
        print(f"verify_chain: OK — {path}")
        return 0
    print(f"verify_chain: FAIL — tamper detected in {path}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
