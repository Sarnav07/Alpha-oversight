"""Phase 1C — MockBand in-process loopback transport.

MockBand models a *two-identity* @mention round-trip with the same lifecycle
semantics as real Band: a message sent by identity A mentioning peer B lands in
B's inbox (not A's), B drains it / recvs it, and marks it processing/processed.
``drain_backlog`` yields any messages already queued (crash-recovery path).

No network, no Phoenix — a shared in-process broker keyed by identity.
"""

from __future__ import annotations

import asyncio

import pytest

from alpha_oversight.band.mock_band import MockBand
from alpha_oversight.band.transport import BandTransport, Inbound
from alpha_oversight.contracts.band_envelope import BandKind, Envelope


def _env(to: str, from_: str = "investigator", **kw) -> Envelope:
    base = dict(
        case_id="case-42",
        to=to,
        kind=BandKind.HANDOFF,
        payload={"hello": "world"},
    )
    base.update(kw)
    return Envelope(from_=from_, **base)


def _pair() -> tuple[MockBand, MockBand]:
    """A connected R&D <-> Surveillance identity pair on one shared broker."""
    return MockBand.pair("rnd", "surv")


def test_mockband_satisfies_transport_protocol() -> None:
    a, _ = _pair()
    # runtime_checkable Protocol — structural conformance.
    assert isinstance(a, BandTransport)


async def test_send_returns_band_message_id() -> None:
    a, _ = _pair()
    bmid = await a.send("room-1", _env("surv"), mention_peer="surv")
    assert isinstance(bmid, str)
    assert bmid  # non-empty


async def test_send_then_recv_round_trip_lands_in_peer_inbox() -> None:
    rnd, surv = _pair()
    env = _env("surv", from_="rnd")
    bmid = await rnd.send("room-1", env, mention_peer="surv")

    # The message lands in the *peer's* inbox, not the sender's.
    inbound = await surv.recv()
    assert isinstance(inbound, Inbound)
    assert inbound.band_message_id == bmid
    assert inbound.room_id == "room-1"

    # The content round-trips back to the same envelope.
    parsed = Envelope.parse_mention(inbound.content)
    assert parsed.from_ == "rnd"
    assert parsed.to == "surv"
    assert parsed.case_id == "case-42"
    assert parsed.msg_id == env.msg_id
    assert parsed.payload == {"hello": "world"}


async def test_sender_does_not_receive_its_own_message() -> None:
    rnd, surv = _pair()
    await rnd.send("room-1", _env("surv", from_="rnd"), mention_peer="surv")
    # Sender's own inbox is empty; only the peer got it.
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(rnd.recv(), timeout=0.05)


async def test_mark_processing_and_processed_lifecycle() -> None:
    rnd, surv = _pair()
    bmid = await rnd.send("room-1", _env("surv"), mention_peer="surv")
    inbound = await surv.recv()

    await surv.mark_processing(inbound.band_message_id)
    await surv.mark_processed(inbound.band_message_id)

    assert bmid in surv.processing
    assert bmid in surv.processed
    # Lifecycle is recorded in order on the receiving identity.
    assert surv.processing == [bmid]
    assert surv.processed == [bmid]


async def test_drain_backlog_yields_queued_then_empties() -> None:
    rnd, surv = _pair()
    e1 = _env("surv", payload={"n": 1})
    e2 = _env("surv", payload={"n": 2})
    await rnd.send("room-1", e1, mention_peer="surv")
    await rnd.send("room-1", e2, mention_peer="surv")

    drained = [inb async for inb in surv.drain_backlog()]
    assert len(drained) == 2
    payloads = [Envelope.parse_mention(i.content).payload["n"] for i in drained]
    assert payloads == [1, 2]  # FIFO order preserved

    # Backlog is now empty — a second drain yields nothing.
    again = [inb async for inb in surv.drain_backlog()]
    assert again == []


async def test_round_trip_both_directions() -> None:
    """Two identities each send to the other; isolation holds both ways."""
    rnd, surv = _pair()
    await rnd.send("r", _env("surv", from_="rnd"), mention_peer="surv")
    await surv.send("r", _env("rnd", from_="surv"), mention_peer="rnd")

    got_surv = await surv.recv()
    got_rnd = await rnd.recv()
    assert Envelope.parse_mention(got_surv.content).from_ == "rnd"
    assert Envelope.parse_mention(got_rnd.content).from_ == "surv"
