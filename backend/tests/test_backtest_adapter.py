"""Backtest adapter — R&D Oracle-2 (Phase-2).

The adapter is the ONE place the two order types meet:
  - ``to_quant_orders``: PLACE/FILL ``OrderEvent`` -> quant ``Order`` with field
    translation (quantity->qty, symbol->instrument, Side enum->Literal); CANCEL skipped.
  - ``synth_market_data``: deterministic synthetic OHLCV + daily_vol + adv per day.
  - ``is_profitable_and_moved``: runs the real ``BacktestEngine`` and returns
    True iff closing-trade PnL > 0 AND some trade moved price (slippage_bps > THRESH).

No LLMs, no Band — pure deterministic backtest math.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from alpha_oversight.contracts.exchange_contracts import (
    ExchangeOrder,
    OrderStatus,
    OrderType,
    Side,
)
from alpha_oversight.contracts.order_events import OrderAction, OrderEvent
from alpha_oversight.generators import backtest_adapter as ba
from alpha_oversight.reused.quant.backtest_engine import DayMarketData
from alpha_oversight.reused.quant.contracts import Order as QuantOrder

_T0 = datetime(2026, 6, 14, 14, 0, 0, tzinfo=timezone.utc)
_SYMBOL = "ACME"


def _evt(
    action: OrderAction,
    side: Side,
    qty: int,
    *,
    day: int = 0,
    order_type: OrderType = OrderType.MARKET,
    price: float | None = None,
    status: OrderStatus = OrderStatus.FILLED,
    oid: str = "o-1",
) -> OrderEvent:
    o = ExchangeOrder(
        order_id=oid,
        symbol=_SYMBOL,
        side=side,
        quantity=qty,
        order_type=order_type,
        limit_price=price,
        status=status,
    )
    # day_num is carried via the timestamp's day offset from _T0.
    return OrderEvent(action=action, order=o, timestamp=_T0 + timedelta(days=day), trader_id="rnd")


# ── field translation: ExchangeOrder -> quant Order ──────────────────────────


def test_to_quant_orders_translates_fields() -> None:
    """quantity->qty, symbol->instrument, Side enum->Literal str, type->Literal."""
    events = [
        _evt(OrderAction.PLACE, Side.BUY, 250, day=0, order_type=OrderType.LIMIT, price=10.5),
    ]
    by_day = ba.to_quant_orders(events)

    assert isinstance(by_day, dict)
    assert set(by_day.keys()) == {0}
    orders = by_day[0]
    assert len(orders) == 1
    od = orders[0]
    assert isinstance(od, QuantOrder)
    # field-name translation
    assert od.instrument == _SYMBOL          # symbol -> instrument
    assert od.qty == 250                     # quantity -> qty
    # enum -> Literal[str]: the value is the plain string, not the enum
    assert od.side == "BUY"
    assert not isinstance(od.side, Side)
    assert od.order_type == "LIMIT"
    assert od.limit_price == 10.5


def test_to_quant_orders_skips_cancel_and_keeps_place_fill() -> None:
    events = [
        _evt(OrderAction.PLACE, Side.BUY, 100, day=0, oid="a"),
        _evt(OrderAction.CANCEL, Side.BUY, 100, day=0, status=OrderStatus.CANCELLED, oid="a"),
        _evt(OrderAction.FILL, Side.SELL, 100, day=1, oid="b"),
        _evt(OrderAction.MODIFY, Side.SELL, 100, day=1, oid="b"),
    ]
    by_day = ba.to_quant_orders(events)
    # CANCEL and MODIFY are not fillable orders -> skipped; PLACE(day0)+FILL(day1) kept.
    assert sorted(by_day.keys()) == [0, 1]
    assert len(by_day[0]) == 1
    assert by_day[0][0].side == "BUY"
    assert len(by_day[1]) == 1
    assert by_day[1][0].side == "SELL"


def test_to_quant_orders_sell_side_maps() -> None:
    # day_num is RELATIVE to the earliest fillable event, so a lone day-2 event
    # normalizes to backtest day 0.
    events = [_evt(OrderAction.FILL, Side.SELL, 50, day=2)]
    by_day = ba.to_quant_orders(events)
    assert list(by_day.keys()) == [0]
    assert by_day[0][0].side == "SELL"
    assert by_day[0][0].qty == 50


def test_to_quant_orders_empty() -> None:
    assert ba.to_quant_orders([]) == {}


def test_to_quant_orders_all_cancel_is_empty() -> None:
    events = [
        _evt(OrderAction.CANCEL, Side.BUY, 10, day=0, status=OrderStatus.CANCELLED),
        _evt(OrderAction.CANCEL, Side.SELL, 10, day=1, status=OrderStatus.CANCELLED),
    ]
    assert ba.to_quant_orders(events) == {}


# ── synth_market_data: deterministic synthetic OHLCV ─────────────────────────


def test_synth_market_data_shape_and_determinism() -> None:
    md1 = ba.synth_market_data([_SYMBOL], days=3, seed=0)
    md2 = ba.synth_market_data([_SYMBOL], days=3, seed=0)
    assert len(md1) == 3
    assert all(isinstance(d, DayMarketData) for d in md1)
    # day numbering is 0..days-1 and consistent
    assert [d.day_num for d in md1] == [0, 1, 2]
    # deterministic for a fixed seed
    assert [d.ohlcv[_SYMBOL].close for d in md1] == [d.ohlcv[_SYMBOL].close for d in md2]
    # each day carries the OHLCV / vol / adv the engine needs
    for d in md1:
        bar = d.ohlcv[_SYMBOL]
        assert bar.high >= bar.low > 0
        assert bar.high >= bar.open and bar.high >= bar.close
        assert bar.low <= bar.open and bar.low <= bar.close
        assert d.daily_vol[_SYMBOL] > 0
        assert d.adv[_SYMBOL] > 0


def test_synth_market_data_seed_changes_path() -> None:
    a = ba.synth_market_data([_SYMBOL], days=4, seed=1)
    b = ba.synth_market_data([_SYMBOL], days=4, seed=2)
    assert [d.ohlcv[_SYMBOL].close for d in a] != [d.ohlcv[_SYMBOL].close for d in b]


# ── is_profitable_and_moved: the Oracle-2 verdict ────────────────────────────


def _profitable_manipulative_sequence() -> list[OrderEvent]:
    """Buy a large block day 0, sell it day 1 after the price has run up.

    The block is large vs synthetic ADV, so the engine's square-root impact
    pushes slippage_bps over THRESH (it 'moved' the market); the day-1 exit is
    above the day-0 entry, so the closing trade books positive PnL.
    """
    big = 40_000  # large vs synth ADV -> impact_bps clears THRESH
    return [
        _evt(OrderAction.PLACE, Side.BUY, big, day=0, oid="acc"),
        _evt(OrderAction.PLACE, Side.SELL, big, day=1, oid="exit"),
    ]


def test_profitable_manipulative_sequence_is_true() -> None:
    events = _profitable_manipulative_sequence()
    assert ba.is_profitable_and_moved(events, seed=0) is True


def test_flat_noop_sequence_is_false() -> None:
    """A tiny single BUY: never closed (no realized PnL) and too small to move
    price -> not profitable AND did not move -> False."""
    events = [_evt(OrderAction.PLACE, Side.BUY, 1, day=0)]
    assert ba.is_profitable_and_moved(events, seed=0) is False


def test_empty_sequence_is_false() -> None:
    assert ba.is_profitable_and_moved([], seed=0) is False


def test_all_cancel_sequence_is_false() -> None:
    """CANCEL-only -> no orders reach the engine -> no trades -> False."""
    events = [
        _evt(OrderAction.CANCEL, Side.BUY, 5000, day=0, status=OrderStatus.CANCELLED),
    ]
    assert ba.is_profitable_and_moved(events, seed=0) is False


def test_result_is_deterministic() -> None:
    events = _profitable_manipulative_sequence()
    assert ba.is_profitable_and_moved(events, seed=0) == ba.is_profitable_and_moved(events, seed=0)
