import sys

from swing_screener.cli import main
from swing_screener.execution.orders import Order, load_orders, save_orders
from swing_screener.portfolio.state import Position, load_positions, save_positions


def _run_cli(args: list[str]) -> None:
    old_argv = sys.argv
    try:
        sys.argv = ["swing-screener"] + args
        main()
    finally:
        sys.argv = old_argv


def test_cli_orders_fill_e2e(tmp_path, capsys):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"

    save_orders(
        orders_path,
        [
            Order(
                order_id="ORD-AAA-ENTRY",
                ticker="AAA",
                status="pending",
                order_type="BUY_LIMIT",
                quantity=1,
                limit_price=10.0,
            )
        ],
        asof="2026-02-02",
    )
    save_positions(positions_path, [], asof="2026-02-02")

    _run_cli(
        [
            "orders",
            "fill",
            "--orders",
            str(orders_path),
            "--positions",
            str(positions_path),
            "--order-id",
            "ORD-AAA-ENTRY",
            "--fill-price",
            "10.5",
            "--fill-date",
            "2026-02-02",
            "--quantity",
            "2",
            "--stop-price",
            "9.5",
        ]
    )
    out = capsys.readouterr().out
    assert "Order filled" in out

    orders_after = load_orders(orders_path)
    positions_after = load_positions(positions_path)
    assert any(o.order_id == "ORD-AAA-ENTRY" and o.status == "filled" for o in orders_after)
    assert positions_after and positions_after[0].ticker == "AAA"


def test_cli_orders_scale_in_e2e(tmp_path, capsys):
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

    _run_cli(
        [
            "orders",
            "scale-in",
            "--orders",
            str(orders_path),
            "--positions",
            str(positions_path),
            "--order-id",
            "ORD-AAA-ENTRY",
            "--fill-price",
            "12.0",
            "--fill-date",
            "2026-02-02",
            "--quantity",
            "2",
        ]
    )
    out = capsys.readouterr().out
    assert "Scale-in filled" in out

    orders_after = load_orders(orders_path)
    positions_after = load_positions(positions_path)
    assert any(o.order_id == "ORD-AAA-ENTRY" and o.status == "filled" for o in orders_after)
    assert positions_after[0].shares == 3


def test_cli_orders_list_and_cancel_e2e(tmp_path, capsys):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"

    save_orders(
        orders_path,
        [
            Order(
                order_id="ORD-AAA-ENTRY",
                ticker="AAA",
                status="pending",
                order_type="BUY_LIMIT",
                quantity=1,
                limit_price=10.0,
            )
        ],
        asof="2026-02-02",
    )
    save_positions(positions_path, [], asof="2026-02-02")

    _run_cli(["orders", "list", "--orders", str(orders_path), "--status", "pending"])
    out = capsys.readouterr().out
    assert "ORD-AAA-ENTRY" in out

    _run_cli(["orders", "cancel", "--orders", str(orders_path), "--order-id", "ORD-AAA-ENTRY"])
    out = capsys.readouterr().out
    assert "Order cancelled" in out

    orders_after = load_orders(orders_path)
    assert orders_after[0].status == "cancelled"
