"""Shared test fixtures — mocked LLMs + MockBand doubles.

Phase-0 contract: NOTHING here touches a live API or the network. LLM calls
are mocked via ``FakeGateway`` / a monkeypatched ``litellm.acompletion`` that
returns canned, schema-valid JSON. Band transport in tests is an in-process
double.

Note: many Phase-0 modules are stubs whose ``__init__`` raises
``NotImplementedError``. Fixtures that build those real classes
(``rule_store``, ``ledger_real``, ``mock_band``) are lazy — pytest only runs a
fixture body when a test requests it, so ``--collect-only`` and
``test_imports`` stay green until the modules are implemented.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from types import SimpleNamespace

import pytest

from alpha_oversight.contracts.rule_contracts import Rule, RuleFamily
from alpha_oversight.reused.events import ActivityEvent


# ── Canned LLM response ──────────────────────────────────────────────────────

# A permissive JSON object that satisfies the common agent schemas
# (AnomalyOut, InvestigationOut, ...). Individual tests can override the payload
# when they need a specific shape.
CANNED_LLM_JSON: dict = {
    "suspicious": True,
    "features": {
        "cancel_to_fill": 0.9,
        "depth_levels": 4,
        "self_match_ratio": 0.1,
        "eod_print_spike": False,
    },
    "case_id": "case-test",
    "specialist": "@layer-spec",
    "rationale": "canned",
    "candidate_inputs": {"window_ms": 400},
    "headline": "canned headline",
    "detail": "canned detail",
    "claimed_inputs": {},
    "window_ms": 400,
    "bona_fide_ids": [],
    "intent": "test",
    "packet": {},
    "recommend": "escalate",
    "events": [],
    "params": {},
}


def _make_fake_response(content: str) -> SimpleNamespace:
    """Build an object shaped like a litellm ChatCompletion response."""
    message = SimpleNamespace(content=content, tool_calls=None, reasoning_content=None)
    choice = SimpleNamespace(message=message, finish_reason="stop")
    usage = SimpleNamespace(prompt_tokens=10, completion_tokens=10)
    return SimpleNamespace(choices=[choice], usage=usage, _hidden_params={})


class FakeGateway:
    """Stand-in for the LLM gateway: records calls, returns canned JSON.

    ``payload`` may be overridden per test to return a schema-specific object.
    """

    def __init__(self, payload: dict | None = None) -> None:
        self.payload = payload if payload is not None else dict(CANNED_LLM_JSON)
        self.calls: list[dict] = []

    def set_payload(self, payload: dict) -> None:
        self.payload = payload

    async def acompletion(self, **kwargs):
        self.calls.append(kwargs)
        return _make_fake_response(json.dumps(self.payload))


@pytest.fixture
def fake_gateway() -> FakeGateway:
    return FakeGateway()


@pytest.fixture
def patch_litellm(monkeypatch, fake_gateway: FakeGateway) -> FakeGateway:
    """Monkeypatch ``litellm.acompletion`` to return canned schema-valid JSON."""
    import litellm

    monkeypatch.setattr(litellm, "acompletion", fake_gateway.acompletion)
    return fake_gateway


# ── In-process doubles for cross-module collaborators ────────────────────────


class FakeEventBus:
    """Captures published ActivityEvents (no real SSE queues)."""

    def __init__(self) -> None:
        self.events: list[ActivityEvent] = []

    async def publish(self, event: ActivityEvent) -> None:
        self.events.append(event)

    def subscribe(self) -> asyncio.Queue:  # pragma: no cover - parity with EventBus
        return asyncio.Queue(maxsize=100)

    def unsubscribe(self, q: asyncio.Queue) -> None:  # pragma: no cover
        pass


class FakeLedger:
    """In-memory ledger double with a real sha256 prev_hash chain."""

    def __init__(self) -> None:
        self.entries: list[dict] = []
        self._head = ""

    def append(self, entry: dict, prev_hash: str) -> str:
        body = json.dumps(entry, sort_keys=True, separators=(",", ":"))
        h = hashlib.sha256((prev_hash + body).encode()).hexdigest()
        record = {
            **entry,
            "band_message_id": entry.get("bmid"),
            "prev_hash": prev_hash,
            "hash": h,
        }
        self.entries.append(record)
        self._head = h
        return h

    def head(self) -> str:
        return self._head


class FakeBand:
    """In-process BandTransport double: an asyncio.Queue loopback.

    Mirrors the @mention round-trip + message-lifecycle calls without the real
    Phoenix WS. Distinct from the (Phase-0-stubbed) ``MockBand`` class so unit
    tests have a working double immediately.
    """

    def __init__(self) -> None:
        self._queue: asyncio.Queue = asyncio.Queue()
        self.processing: list[str] = []
        self.processed: list[str] = []
        self._counter = 0

    async def send(self, room: str, env, mention_peer: str) -> str:
        from alpha_oversight.band.transport import Inbound

        self._counter += 1
        bmid = f"bmid-{self._counter}"
        await self._queue.put(
            Inbound(band_message_id=bmid, room_id=room, content=env.to_mention())
        )
        return bmid

    async def recv(self):
        return await self._queue.get()

    async def mark_processing(self, msg_id: str) -> None:
        self.processing.append(msg_id)

    async def mark_processed(self, msg_id: str) -> None:
        self.processed.append(msg_id)

    async def drain_backlog(self):
        while not self._queue.empty():
            yield self._queue.get_nowait()


@pytest.fixture
def fake_bus() -> FakeEventBus:
    return FakeEventBus()


@pytest.fixture
def fake_ledger() -> FakeLedger:
    return FakeLedger()


@pytest.fixture
def fake_band() -> FakeBand:
    return FakeBand()


# ── Temp dirs + sqlite paths ─────────────────────────────────────────────────


@pytest.fixture
def ledger_dir(tmp_path) -> str:
    d = tmp_path / "ledger"
    d.mkdir()
    return str(d)


@pytest.fixture
def events_dir(tmp_path) -> str:
    d = tmp_path / "events"
    d.mkdir()
    return str(d)


@pytest.fixture
def ledger_jsonl(ledger_dir) -> str:
    return f"{ledger_dir}/ledger.jsonl"


@pytest.fixture
def case_db(tmp_path) -> str:
    return str(tmp_path / "cases.db")


@pytest.fixture
def rules_db(tmp_path) -> str:
    return str(tmp_path / "rules.db")


@pytest.fixture
def memory_db(tmp_path) -> str:
    return str(tmp_path / "memory.db")


# ── Seed rules + lazy real-class fixtures (materialize only when requested) ──


@pytest.fixture
def seed_rules_list() -> list[Rule]:
    """A small curated rule set, built directly (no engine impl needed)."""
    return [
        Rule(
            id="FINRA-5210-layering",
            family=RuleFamily.LAYERING,
            params={"window_ms": 100, "min_depth_levels": 3},
            provenance="FINRA-5210",
        ),
        Rule(
            id="FINRA-5210-spoofing",
            family=RuleFamily.SPOOFING,
            params={"window_ms": 100, "min_cancel_ratio": 0.8},
            provenance="FINRA-5210",
        ),
        Rule(
            id="SEC-10b-5-wash",
            family=RuleFamily.WASH_TRADE,
            params={"min_self_match_ratio": 0.5},
            provenance="SEC-10b-5",
        ),
    ]


@pytest.fixture
def rule_store(rules_db, seed_rules_list):
    """A seeded RuleRegistryStore.

    Lazy: constructing the real store will raise until Phase 1A implements it.
    Once implemented, this seeds it with ``seed_rules_list`` and returns it.
    """
    from alpha_oversight.rules.registry import RuleRegistryStore

    store = RuleRegistryStore(rules_db)
    for rule in seed_rules_list:
        store.codify(rule)
    return store


@pytest.fixture
def ledger_real(ledger_jsonl, rules_db):
    """The real hash-chained Ledger (lazy; raises until Phase 1D implements it)."""
    from alpha_oversight.audit.ledger import Ledger

    return Ledger(ledger_jsonl, rules_db)


@pytest.fixture
def mock_band():
    """The real MockBand transport (lazy; raises until Phase 1C implements it)."""
    from alpha_oversight.band.mock_band import MockBand

    return MockBand()
