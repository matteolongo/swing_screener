from swing_screener.execution.order_workflows import (
    fill_entry_order,
    scale_in_fill,
)
from swing_screener.execution.orders import Order
from swing_screener.portfolio.state import Position


def test_fill_entry_order_creates_position_and_stop():
    orders = [
        Order(
            order_id="ORD-AAA-ENTRY",
            ticker="AAA",
            status="pending",
            order_type="BUY_LIMIT",
            quantity=1,
            limit_price=10.0,
        )
    ]
    positions: list[Position] = []

    new_orders, new_positions = fill_entry_order(
        orders,
        positions,
        "ORD-AAA-ENTRY",
        fill_price=10.5,
        fill_date="2026-02-02",
        quantity=3,
        stop_price=9.5,
    )

    entry = next(o for o in new_orders if o.order_id == "ORD-AAA-ENTRY")
    assert entry.status == "filled"
    assert entry.position_id == "POS-AAA-20260202-01"
    assert entry.entry_price == 10.5

    stop = next(o for o in new_orders if o.order_kind == "stop")
    assert stop.order_type == "SELL_STOP"
    assert stop.quantity == 3
    assert stop.stop_price == 9.5
    assert stop.position_id == "POS-AAA-20260202-01"

    pos = next(p for p in new_positions if p.ticker == "AAA")
    assert pos.position_id == "POS-AAA-20260202-01"
    assert pos.entry_price == 10.5
    assert pos.stop_price == 9.5
    assert pos.shares == 3
    assert pos.initial_risk == 1.0
    assert pos.exit_order_ids == [stop.order_id]


def test_fill_entry_order_rejects_existing_open_position():
    orders = [
        Order(
            order_id="ORD-AAA-ENTRY",
            ticker="AAA",
            status="pending",
            order_type="BUY_LIMIT",
            quantity=1,
            limit_price=10.0,
        )
    ]
    positions = [
        Position(
            ticker="AAA",
            status="open",
            entry_date="2026-01-10",
            entry_price=9.0,
            stop_price=8.0,
            shares=1,
        )
    ]

    try:
        fill_entry_order(
            orders,
            positions,
            "ORD-AAA-ENTRY",
            fill_price=10.0,
            fill_date="2026-02-02",
            quantity=1,
            stop_price=9.0,
        )
        assert False, "Expected ValueError for open position."
    except ValueError as exc:
        assert "open position" in str(exc).lower()


def test_scale_in_fill_blends_and_updates_stop():
    orders = [
        Order(
            order_id="ORD-AAA-ENTRY",
            ticker="AAA",
            status="pending",
            order_type="BUY_LIMIT",
            quantity=2,
            limit_price=12.0,
        ),
        Order(
            order_id="ORD-STOP-POS-AAA-20260101-01",
            ticker="AAA",
            status="pending",
            order_type="SELL_STOP",
            quantity=2,
            stop_price=8.0,
            order_kind="stop",
            position_id="POS-AAA-20260101-01",
        ),
    ]
    positions = [
        Position(
            ticker="AAA",
            status="open",
            position_id="POS-AAA-20260101-01",
            source_order_id="ORD-AAA-OLD",
            entry_date="2026-01-01",
            entry_price=10.0,
            stop_price=8.0,
            shares=2,
            initial_risk=2.0,
            max_favorable_price=11.0,
            exit_order_ids=["ORD-STOP-POS-AAA-20260101-01"],
        )
    ]

    new_orders, new_positions = scale_in_fill(
        orders,
        positions,
        "ORD-AAA-ENTRY",
        fill_price=12.0,
        fill_date="2026-02-02",
        quantity=3,
    )

    pos = next(p for p in new_positions if p.ticker == "AAA")
    assert pos.shares == 5
    assert pos.stop_price == 8.0
    assert pos.entry_price == (10.0 * 2 + 12.0 * 3) / 5
    assert pos.initial_risk == round(pos.entry_price - 8.0, 4)

    stop = next(o for o in new_orders if o.order_kind == "stop")
    assert stop.quantity == 5
    assert stop.stop_price == 8.0

    entry = next(o for o in new_orders if o.order_id == "ORD-AAA-ENTRY")
    assert entry.status == "filled"
    assert entry.position_id == "POS-AAA-20260101-01"


def test_scale_in_fill_creates_stop_if_missing():
    orders = [
        Order(
            order_id="ORD-AAA-ENTRY",
            ticker="AAA",
            status="pending",
            order_type="BUY_LIMIT",
            quantity=1,
            limit_price=12.0,
        )
    ]
    positions = [
        Position(
            ticker="AAA",
            status="open",
            position_id="POS-AAA-20260101-01",
            source_order_id="ORD-AAA-OLD",
            entry_date="2026-01-01",
            entry_price=10.0,
            stop_price=8.0,
            shares=1,
            initial_risk=2.0,
            max_favorable_price=11.0,
            exit_order_ids=[],
        )
    ]

    new_orders, new_positions = scale_in_fill(
        orders,
        positions,
        "ORD-AAA-ENTRY",
        fill_price=12.0,
        fill_date="2026-02-02",
        quantity=1,
    )

    stop = next(o for o in new_orders if o.order_kind == "stop")
    assert stop.position_id == "POS-AAA-20260101-01"

    pos = next(p for p in new_positions if p.ticker == "AAA")
    assert stop.order_id in pos.exit_order_ids
