"""Phase-5 — the R&D adversary co-evolution loop (orchestration/rnd_loop.py).

``run_rnd`` drives up to K rounds: a (mocked) Adversary proposes a
``list[OrderEvent]``; Oracle-1 (rule engine MISS == PASS) checks it evades the
CURRENT registry; Oracle-2 (backtest P&L) checks it is economically real. A
sequence that EVADES *and* PROFITS is a confirmed novel evasion, handed across
the Chinese wall via the ``SanitizedBridge`` (kind=HANDOFF, events only) and
returned. Otherwise the loop advances; it is bounded to K rounds (no wedge).

No live API, no network: the Adversary is a fake whose ``run`` returns a canned
``AdversaryOut``; the oracles are the real deterministic rule engine + backtest.
"""

from __future__ import annotations

from datetime import timedelta

import pytest

from alpha_oversight.audit.ledger import Ledger
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.band.mock_band import MockBand
from alpha_oversight.contracts.band_envelope import BandKind, Envelope
from alpha_oversight.contracts.case_contracts import AdversaryOut, ResolvedInputs
from alpha_oversight.contracts.exchange_contracts import (
    ExchangeOrder,
    OrderStatus,
    OrderType,
    Side,
)
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent
from alpha_oversight.generators.scenarios import _SYMBOL, _T0, novel_layering_evasion
from alpha_oversight.orchestration.rnd_loop import RnDResult, run_rnd
from alpha_oversight.reused.events import EventBus
from alpha_oversight.rules.seed_rules import seed_rules


class FakeAdversary:
    """Stand-in for the Adversary agent: returns a scripted sequence per round.

    Records every ``run`` so the test can assert the K-round cap. ``sequences``
    is consumed one per call; once exhausted it keeps yielding the last one.
    """

    def __init__(self, sequences: list[list[OrderEvent]]) -> None:
        self._sequences = sequences
        self.calls: list[str] = []

    async def run(self, user_prompt, schema=None):  # noqa: ANN001 - mirrors SurveillanceAgent.run
        idx = min(len(self.calls), len(self._sequences) - 1)
        self.calls.append(user_prompt)
        return AdversaryOut(events=self._sequences[idx], params={"round": len(self.calls)})


def _big_fill(oid: str, side: Side, qty: int, day: int) -> OrderEvent:
    """A large market round-trip leg: big vs synth ADV so the backtest impact bites."""
    o = ExchangeOrder(
        order_id=oid,
        symbol=_SYMBOL,
        side=side,
        quantity=qty,
        order_type=OrderType.MARKET,
        status=OrderStatus.FILLED,
        filled_quantity=qty,
        avg_fill_price=10.00,
    )
    return OrderEvent(
        action=OrderAction.PLACE, order=o, timestamp=_T0 + timedelta(days=day), trader_id="spoofy2"
    )


def _novel_profitable_evasion() -> list[OrderEvent]:
    """A confirmed novel evasion: the ~400ms layering shape that PASSes the seed
    rules (Oracle-1 MISS) PLUS a large buy-low/sell-high round-trip that the
    backtest scores as economically real (Oracle-2: P&L>0 AND moved price).

    This is what a real adversary extracts — the deceptive ladder evades the
    detector while the block round-trip captures the value.
    """
    return novel_layering_evasion() + [
        _big_fill("acc", Side.BUY, 40_000, day=0),
        _big_fill("exit", Side.SELL, 40_000, day=1),
    ]


def _flat_sequence() -> list[OrderEvent]:
    """A benign, non-manipulative single FILL: trips no rule AND moves no price."""
    order = ExchangeOrder(
        order_id="benign-1",
        symbol=_SYMBOL,
        side=Side.BUY,
        quantity=1,
        order_type=OrderType.LIMIT,
        limit_price=10.00,
        status=OrderStatus.FILLED,
        filled_quantity=1,
        avg_fill_price=10.00,
    )
    return [OrderEvent(action=OrderAction.FILL, order=order, timestamp=_T0, trader_id="joe")]


def _make_handoff(tmp_path):
    """A real BandHandoff over a MockBand pair (R&D -> Surveillance), real Ledger.

    The bridge mentions peer ``@anomaly-detector``; MockBand routes by *mentioned
    peer*, so the crossing lands in that peer's broker inbox (not the named
    surveillance identity). We return the R&D band so the test can reach the
    shared broker and inspect what crossed.
    """
    ledger = Ledger(str(tmp_path / "ledger.jsonl"), str(tmp_path / "rules.db"))
    bus = EventBus()
    rnd_band, _surv_band = MockBand.pair("rnd", "surveillance")
    rnd_handoff = BandHandoff(rnd_band, ledger, bus, desk="rnd")
    return rnd_handoff, rnd_band, ledger


def _drain_envelopes(rnd_band: MockBand) -> list[Envelope]:
    """Pop everything the bridge delivered to the surveillance-side inbox.

    The SanitizedBridge sends to peer ``anomaly-detector``; on the shared broker
    that is the inbox the crossing lands in. Parse each as an Envelope.
    """
    inbox = rnd_band._broker.inboxes.get("anomaly-detector")
    out: list[Envelope] = []
    if inbox is None:
        return out
    while not inbox.empty():
        inbound = inbox.get_nowait()
        out.append(Envelope.parse_mention(inbound.content))
    return out


@pytest.mark.asyncio
async def test_evades_and_profits_is_confirmed_and_handed_over(tmp_path):
    """Oracle-1 misses + Oracle-2 profitable => confirmed evasion + HANDOFF (events only)."""
    rnd_handoff, rnd_band, _ledger = _make_handoff(tmp_path)
    evasion = _novel_profitable_evasion()
    adversary = FakeAdversary([evasion])

    result = await run_rnd(
        registry_snapshot=seed_rules(),
        handoff=rnd_handoff,
        resolved_inputs=ResolvedInputs(),
        K=3,
        seed=0,
        surveillance_room="case-rnd",
        adversary=adversary,
    )

    # confirmed novel evasion is returned, carrying the proposed events
    assert isinstance(result, RnDResult)
    assert result.confirmed is True
    assert result.events == evasion
    assert result.rounds == 1  # caught on the first round

    # exactly one HANDOFF envelope crossed the wall, carrying ONLY events
    envelopes = _drain_envelopes(rnd_band)
    handoffs = [e for e in envelopes if e.kind is BandKind.HANDOFF]
    assert len(handoffs) == 1
    payload = handoffs[0].payload
    assert set(payload.keys()) == {"events"}  # no R&D reasoning crosses
    assert len(payload["events"]) == len(evasion)
    # the crossed events were sanitized (no R&D model_key / reasoning leakage)
    for ev in payload["events"]:
        assert ev["order"]["model_key"] == ""
        assert ev["order"]["reasoning"] == ""


@pytest.mark.asyncio
async def test_flat_benign_sequence_is_not_confirmed(tmp_path):
    """A flat/benign sequence evades but is not economically real => NOT confirmed."""
    rnd_handoff, rnd_band, _ledger = _make_handoff(tmp_path)
    adversary = FakeAdversary([_flat_sequence()])

    result = await run_rnd(
        registry_snapshot=seed_rules(),
        handoff=rnd_handoff,
        resolved_inputs=ResolvedInputs(),
        K=3,
        seed=0,
        surveillance_room="case-rnd",
        adversary=adversary,
    )

    assert result.confirmed is False
    assert result.events is None
    # nothing crossed the Chinese wall (no HANDOFF emitted)
    assert _drain_envelopes(rnd_band) == []


@pytest.mark.asyncio
async def test_k_round_cap_terminates_the_loop(tmp_path):
    """No sequence ever both evades + profits => loop stops at exactly K rounds."""
    rnd_handoff, rnd_band, _ledger = _make_handoff(tmp_path)
    # Every round yields a flat sequence => never confirmed.
    adversary = FakeAdversary([_flat_sequence()])

    K = 3
    result = await run_rnd(
        registry_snapshot=seed_rules(),
        handoff=rnd_handoff,
        resolved_inputs=ResolvedInputs(),
        K=K,
        seed=0,
        surveillance_room="case-rnd",
        adversary=adversary,
    )

    assert result.confirmed is False
    assert result.rounds == K  # the cap was reached
    assert len(adversary.calls) == K  # the adversary was polled exactly K times
    assert _drain_envelopes(rnd_band) == []
