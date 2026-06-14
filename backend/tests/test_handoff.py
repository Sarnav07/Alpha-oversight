"""Phase 1C — BandHandoff (the one networked seam) + SanitizedBridge.

Unit-level: the transport/ledger/bus collaborators are the conftest in-process
doubles (FakeBand / FakeLedger / FakeEventBus), NOT the real audit module.

Asserted contract:
- ``send`` puts the envelope on the wire AND appends ``sha256(content)`` + the
  band_message_id to the ledger AND publishes a desk-tagged EventBus event.
- ``pump`` is idempotent: a duplicate ``msg_id`` is marked processed but NOT
  dispatched / re-ledgered (deduped via ``_seen``).
- every *delivered* (first-seen) message triggers one ledger.append + one
  bus.publish carrying ``desk``.
- ``SanitizedBridge.publish_flow`` sends ONLY the order events (a HANDOFF
  envelope whose payload has no R&D reasoning).
"""

from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone

import pytest

from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.contracts.band_envelope import BandKind, Envelope
from alpha_oversight.contracts.exchange_contracts import ExchangeOrder, OrderType, Side
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent


def _env(msg_id: str | None = None, to: str = "spoof-spec", **kw) -> Envelope:
    base = dict(
        case_id="case-42",
        from_="investigator",
        to=to,
        kind=BandKind.HANDOFF,
        payload={"k": "v"},
    )
    base.update(kw)
    if msg_id is not None:
        base["msg_id"] = msg_id
    return Envelope(**base)


def _order(**kw) -> ExchangeOrder:
    base = dict(
        symbol="ACME",
        side=Side.BUY,
        quantity=100,
        order_type=OrderType.LIMIT,
        limit_price=10.0,
        reasoning="SECRET R&D rationale: widen cancel window to 400ms",
        model_key="featherless/adversary",
    )
    base.update(kw)
    return ExchangeOrder(**base)


def _events() -> list[OrderEvent]:
    ts = datetime(2026, 6, 14, tzinfo=timezone.utc)
    return [
        OrderEvent(action=OrderAction.PLACE, order=_order(), timestamp=ts, trader_id="r"),
        OrderEvent(
            action=OrderAction.CANCEL,
            order=_order(order_id="o-2", side=Side.SELL),
            timestamp=ts,
            trader_id="r",
        ),
    ]


# ── send: wire + ledger + bus ────────────────────────────────────────────────


async def test_send_returns_bmid_and_puts_on_wire(fake_band, fake_ledger, fake_bus):
    h = BandHandoff(fake_band, fake_ledger, fake_bus, desk="surveillance")
    env = _env()
    bmid = await h.send("room-1", env, peer="spoof-spec")

    assert bmid == "bmid-1"
    # The wire got exactly one message (it's now waiting in the loopback queue).
    inbound = await fake_band.recv()
    assert inbound.band_message_id == bmid
    assert Envelope.parse_mention(inbound.content).msg_id == env.msg_id


async def test_send_appends_sha256_of_content_to_ledger(fake_band, fake_ledger, fake_bus):
    h = BandHandoff(fake_band, fake_ledger, fake_bus, desk="surveillance")
    env = _env()
    content = env.to_mention()
    expected = hashlib.sha256(content.encode()).hexdigest()

    bmid = await h.send("room-1", env, peer="spoof-spec")

    assert len(fake_ledger.entries) == 1
    rec = fake_ledger.entries[0]
    assert rec["sha256"] == expected
    assert rec["band_message_id"] == bmid  # ledger binds bmid via entry["bmid"]


async def test_send_publishes_event_with_desk(fake_band, fake_ledger, fake_bus):
    h = BandHandoff(fake_band, fake_ledger, fake_bus, desk="surveillance")
    await h.send("room-1", _env(), peer="spoof-spec")

    assert len(fake_bus.events) == 1
    ev = fake_bus.events[0]
    assert ev["desk"] == "surveillance"


# ── pump: dispatch + dedup + ledger/bus per delivered message ────────────────


async def test_pump_dispatches_and_ledgers_each_message(fake_band, fake_ledger, fake_bus):
    """Two distinct messages enqueued -> both dispatched, both ledgered/published."""
    inbox = BandHandoff(fake_band, fake_ledger, fake_bus, desk="surveillance")
    # Enqueue two distinct inbound messages directly onto the loopback.
    await fake_band.send("room-1", _env(msg_id="m-1"), mention_peer="surv")
    await fake_band.send("room-1", _env(msg_id="m-2"), mention_peer="surv")

    seen: list[str] = []

    async def dispatch(env: Envelope) -> None:
        seen.append(env.msg_id)

    await inbox.pump(dispatch)  # drains the loopback then returns

    assert seen == ["m-1", "m-2"]
    # Each message: marked processing AND processed.
    assert fake_band.processing == ["bmid-1", "bmid-2"]
    assert fake_band.processed == ["bmid-1", "bmid-2"]
    # Each delivered message -> one ledger append + one bus publish (desk set).
    assert len(fake_ledger.entries) == 2
    assert len(fake_bus.events) == 2
    assert all(e["desk"] == "surveillance" for e in fake_bus.events)


async def test_pump_dedupes_duplicate_msg_id(fake_band, fake_ledger, fake_bus):
    """Same msg_id twice -> dispatched once; the dup is marked processed, skipped."""
    inbox = BandHandoff(fake_band, fake_ledger, fake_bus, desk="surveillance")
    await fake_band.send("room-1", _env(msg_id="dup"), mention_peer="surv")
    await fake_band.send("room-1", _env(msg_id="dup"), mention_peer="surv")

    dispatched: list[str] = []

    async def dispatch(env: Envelope) -> None:
        dispatched.append(env.msg_id)

    await inbox.pump(dispatch)

    # Dispatched exactly once.
    assert dispatched == ["dup"]
    # Both inbound messages were ACKed processing+processed (redeliverability).
    assert fake_band.processing == ["bmid-1", "bmid-2"]
    assert fake_band.processed == ["bmid-1", "bmid-2"]
    # But only the first was ledgered + published (the dup is skipped).
    assert len(fake_ledger.entries) == 1
    assert len(fake_bus.events) == 1


async def test_seen_tracks_msg_ids(fake_band, fake_ledger, fake_bus):
    inbox = BandHandoff(fake_band, fake_ledger, fake_bus, desk="surveillance")
    assert inbox._seen("x") is False
    assert inbox._seen("x") is True  # second call sees it (idempotency set)
    assert inbox._seen("y") is False


async def test_pump_returns_when_backlog_empty(fake_band, fake_ledger, fake_bus):
    """No messages -> pump drains the (empty) backlog and returns promptly."""
    inbox = BandHandoff(fake_band, fake_ledger, fake_bus, desk="surveillance")

    async def dispatch(env: Envelope) -> None:  # pragma: no cover - never called
        raise AssertionError("dispatch should not be called on empty backlog")

    await asyncio.wait_for(inbox.pump(dispatch), timeout=0.2)
    assert fake_ledger.entries == []
    assert fake_bus.events == []


# ── SanitizedBridge: events only, no R&D reasoning ───────────────────────────


async def test_bridge_publishes_events_only_no_reasoning(fake_band, fake_ledger, fake_bus):
    h = BandHandoff(fake_band, fake_ledger, fake_bus, desk="rnd")
    bridge = SanitizedBridge(h, surveillance_room="surv-room")

    await bridge.publish_flow(_events())

    # Exactly one Band message crossed the wall.
    inbound = await fake_band.recv()
    assert inbound.room_id == "surv-room"
    env = Envelope.parse_mention(inbound.content)
    assert env.kind is BandKind.HANDOFF

    # The serialized message must NOT leak the R&D reasoning string.
    assert "SECRET R&D rationale" not in inbound.content

    # Payload carries the events (re-parseable as OrderEvents), reasoning stripped.
    raw_events = env.payload["events"]
    assert len(raw_events) == 2
    for raw in raw_events:
        ev = OrderEvent.model_validate(raw)
        assert ev.order.reasoning == ""  # stripped at the wall


async def test_bridge_ledgers_and_publishes_via_handoff(fake_band, fake_ledger, fake_bus):
    """The bridge rides BandHandoff.send, so it ledgers + publishes too."""
    h = BandHandoff(fake_band, fake_ledger, fake_bus, desk="rnd")
    bridge = SanitizedBridge(h, surveillance_room="surv-room")

    await bridge.publish_flow(_events())

    assert len(fake_ledger.entries) == 1
    assert len(fake_bus.events) == 1
    assert fake_bus.events[0]["desk"] == "rnd"


async def test_bridge_empty_flow_is_noop_safe(fake_band, fake_ledger, fake_bus):
    h = BandHandoff(fake_band, fake_ledger, fake_bus, desk="rnd")
    bridge = SanitizedBridge(h, surveillance_room="surv-room")
    await bridge.publish_flow([])
    # An empty window still sends a (valid, empty) flow envelope.
    inbound = await fake_band.recv()
    env = Envelope.parse_mention(inbound.content)
    assert env.payload["events"] == []
