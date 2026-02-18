from swing_screener.cli import _orders_fill_to_files, _orders_scale_in_to_files
from swing_screener.execution.orders import Order, load_orders, save_orders
from swing_screener.portfolio.state import Position, load_positions, save_positions


def test_cli_orders_fill(tmp_path):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"

    orders = [
        Order(
            order_id="ORD-AAA-ENTRY",
            ticker="AAA",
            status="pending",
            order_type="BUY_LIMIT",
            quantity=1,
            limit_price=10.0,
            notes="",
        )
    ]
    save_orders(orders_path, orders, asof="2026-02-02")
    save_positions(positions_path, [], asof="2026-02-02")

    _orders_fill_to_files(
        orders_path=str(orders_path),
        positions_path=str(positions_path),
        order_id="ORD-AAA-ENTRY",
        fill_price=10.5,
        fill_date="2026-02-02",
        quantity=2,
        stop_price=9.5,
        tp_price=None,
        fee_eur=2.0,
        fill_fx_rate=1.18,
    )

    orders_after = load_orders(orders_path)
    positions_after = load_positions(positions_path)

    entry = next(o for o in orders_after if o.order_id == "ORD-AAA-ENTRY")
    assert entry.status == "filled"
    assert entry.position_id == "POS-AAA-20260202-01"
    assert entry.fee_eur == 2.0
    assert entry.fill_fx_rate == 1.18

    stop = next(o for o in orders_after if o.order_kind == "stop")
    assert stop.quantity == 2
    assert stop.stop_price == 9.5

    pos = positions_after[0]
    assert pos.ticker == "AAA"
    assert pos.shares == 2


def test_cli_orders_scale_in(tmp_path):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"

    orders = [
        Order(
            order_id="ORD-AAA-ENTRY",
            ticker="AAA",
            status="pending",
            order_type="BUY_LIMIT",
            quantity=1,
            limit_price=12.0,
            notes="",
        ),
        Order(
            order_id="ORD-STOP-POS-AAA-20260101-01",
            ticker="AAA",
            status="pending",
            order_type="SELL_STOP",
            quantity=1,
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
            shares=1,
            initial_risk=2.0,
            max_favorable_price=11.0,
            exit_order_ids=["ORD-STOP-POS-AAA-20260101-01"],
        )
    ]
    save_orders(orders_path, orders, asof="2026-02-02")
    save_positions(positions_path, positions, asof="2026-02-02")

    _orders_scale_in_to_files(
        orders_path=str(orders_path),
        positions_path=str(positions_path),
        order_id="ORD-AAA-ENTRY",
        fill_price=12.0,
        fill_date="2026-02-02",
        quantity=2,
        fee_eur=1.5,
        fill_fx_rate=1.17,
    )

    orders_after = load_orders(orders_path)
    positions_after = load_positions(positions_path)

    entry = next(o for o in orders_after if o.order_id == "ORD-AAA-ENTRY")
    assert entry.status == "filled"
    assert entry.position_id == "POS-AAA-20260101-01"
    assert entry.fee_eur == 1.5
    assert entry.fill_fx_rate == 1.17

    stop = next(o for o in orders_after if o.order_kind == "stop")
    assert stop.quantity == 3

    pos = positions_after[0]
    assert pos.shares == 3
    assert pos.stop_price == 8.0
