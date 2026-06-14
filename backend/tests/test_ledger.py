"""Hash-chained audit ledger + canonical JSON (Phase-1D).

The ledger is the compliance system of record. Each leaf binds a Band message
hash via ``h = sha256((prev_hash + canonical_json(entry)).encode())``.
``verify_chain`` recomputes every link, so flipping a single byte in the JSONL
breaks verification. Canonical JSON must be byte-stable regardless of key order
or the chain itself is unreproducible.

No LLMs / no network here — pure stdlib + filesystem.
"""

from __future__ import annotations

import hashlib
import json

from alpha_oversight.audit.canonical import canonical_json
from alpha_oversight.audit.ledger import Ledger


# ── canonical_json ───────────────────────────────────────────────────────────


def test_canonical_json_exact_format() -> None:
    out = canonical_json({"b": 1, "a": 2})
    # sorted keys + tight separators, no spaces
    assert out == '{"a":2,"b":1}'


def test_canonical_json_stable_across_key_order() -> None:
    a = canonical_json({"x": 1, "y": 2, "z": {"p": 3, "q": 4}})
    b = canonical_json({"z": {"q": 4, "p": 3}, "y": 2, "x": 1})
    assert a == b


# ── Ledger.append / head chaining ────────────────────────────────────────────


def test_head_genesis_empty(ledger_jsonl, rules_db) -> None:
    led = Ledger(ledger_jsonl, rules_db)
    assert led.head() == ""


def test_append_chains_prev_hash_from_genesis(ledger_jsonl, rules_db) -> None:
    led = Ledger(ledger_jsonl, rules_db)

    h1 = led.append({"step": "triage", "bmid": "bmid-1"}, prev_hash="")
    assert led.head() == h1

    h2 = led.append({"step": "verdict", "bmid": "bmid-2"}, prev_hash=h1)
    assert led.head() == h2
    assert h1 != h2

    # recompute h1 by hand: genesis prev_hash is the empty string
    body1 = canonical_json({"step": "triage", "bmid": "bmid-1"})
    expected_h1 = hashlib.sha256(("" + body1).encode()).hexdigest()
    assert h1 == expected_h1

    rows = [json.loads(ln) for ln in _read_lines(ledger_jsonl)]
    assert len(rows) == 2
    # first leaf: genesis prev_hash, band_message_id lifted from bmid, hash present
    assert rows[0]["prev_hash"] == ""
    assert rows[0]["band_message_id"] == "bmid-1"
    assert rows[0]["hash"] == h1
    # second leaf chains onto the first
    assert rows[1]["prev_hash"] == h1
    assert rows[1]["band_message_id"] == "bmid-2"
    assert rows[1]["hash"] == h2


def test_head_reads_from_existing_file(ledger_jsonl, rules_db) -> None:
    led = Ledger(ledger_jsonl, rules_db)
    led.append({"step": "a", "bmid": "m1"}, prev_hash="")
    h2 = led.append({"step": "b", "bmid": "m2"}, prev_hash=led.head())

    # a fresh Ledger over the same JSONL must recover the head
    led2 = Ledger(ledger_jsonl, rules_db)
    assert led2.head() == h2


def test_band_message_id_none_when_no_bmid(ledger_jsonl, rules_db) -> None:
    led = Ledger(ledger_jsonl, rules_db)
    led.append({"step": "no-bmid"}, prev_hash="")
    rows = [json.loads(ln) for ln in _read_lines(ledger_jsonl)]
    assert rows[0]["band_message_id"] is None


# ── verify_chain ─────────────────────────────────────────────────────────────


def test_verify_chain_true_on_good_file(ledger_jsonl, rules_db) -> None:
    led = Ledger(ledger_jsonl, rules_db)
    prev = ""
    for i in range(5):
        prev = led.append({"step": f"s{i}", "bmid": f"m{i}"}, prev_hash=prev)
    assert Ledger.verify_chain(ledger_jsonl) is True


def test_verify_chain_true_on_empty_file(ledger_jsonl, rules_db) -> None:
    Ledger(ledger_jsonl, rules_db)  # creates/initializes the empty ledger
    # an empty chain is vacuously valid
    assert Ledger.verify_chain(ledger_jsonl) is True


def test_verify_chain_false_when_one_byte_flipped(ledger_jsonl, rules_db) -> None:
    led = Ledger(ledger_jsonl, rules_db)
    prev = ""
    for i in range(3):
        prev = led.append({"step": f"s{i}", "amount": i, "bmid": f"m{i}"}, prev_hash=prev)
    assert Ledger.verify_chain(ledger_jsonl) is True

    raw = _read_bytes(ledger_jsonl)
    # flip one byte inside the payload of the middle record (a digit -> different digit)
    idx = raw.index(b'"amount":1')
    target = idx + len(b'"amount":')  # the '1'
    flipped = bytearray(raw)
    flipped[target] = ord("9") if flipped[target] != ord("9") else ord("8")
    _write_bytes(ledger_jsonl, bytes(flipped))

    assert Ledger.verify_chain(ledger_jsonl) is False


def test_verify_chain_false_when_hash_tampered(ledger_jsonl, rules_db) -> None:
    led = Ledger(ledger_jsonl, rules_db)
    led.append({"step": "a", "bmid": "m1"}, prev_hash="")
    led.append({"step": "b", "bmid": "m2"}, prev_hash=led.head())

    lines = _read_lines(ledger_jsonl)
    rec = json.loads(lines[0])
    rec["hash"] = "0" * 64  # forge the stored hash
    lines[0] = json.dumps(rec)
    _write_lines(ledger_jsonl, lines)

    assert Ledger.verify_chain(ledger_jsonl) is False


def test_verify_chain_false_when_link_reordered(ledger_jsonl, rules_db) -> None:
    led = Ledger(ledger_jsonl, rules_db)
    led.append({"step": "a", "bmid": "m1"}, prev_hash="")
    led.append({"step": "b", "bmid": "m2"}, prev_hash=led.head())

    lines = _read_lines(ledger_jsonl)
    lines.reverse()  # break the prev_hash linkage
    _write_lines(ledger_jsonl, lines)

    assert Ledger.verify_chain(ledger_jsonl) is False


# ── small file helpers (kept out of Bash per tooling rules) ──────────────────


def _read_lines(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as fh:
        return [ln for ln in fh.read().splitlines() if ln.strip()]


def _write_lines(path: str, lines: list[str]) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def _read_bytes(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()


def _write_bytes(path: str, data: bytes) -> None:
    with open(path, "wb") as fh:
        fh.write(data)
