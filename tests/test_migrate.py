import json

from swing_screener.portfolio.migrate import migrate_orders_positions


def test_migrate_links_positions_and_creates_stop_orders(tmp_path):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"

    orders_payload = {
        "asof": "2026-01-23",
        "orders": [
            {
                "order_id": "ORD-TEST-1",
                "ticker": "VALE",
                "status": "filled",
                "order_type": "BUY_LIMIT",
                "limit_price": 14.6,
                "quantity": 1,
                "stop_price": 14.02,
                "order_date": "2026-01-15",
                "filled_date": "2026-01-16",
                "entry_price": 14.6,
                "notes": "",
            }
        ],
    }
    positions_payload = {
        "asof": "2026-01-23",
        "positions": [
            {
                "ticker": "VALE",
                "status": "open",
                "entry_date": "2026-01-16",
                "entry_price": 14.6,
                "stop_price": 14.02,
                "shares": 1,
                "notes": "",
            }
        ],
    }

    orders_path.write_text(json.dumps(orders_payload), encoding="utf-8")
    positions_path.write_text(json.dumps(positions_payload), encoding="utf-8")

    orders, positions, updated = migrate_orders_positions(
        orders_path,
        positions_path,
        create_stop_orders=True,
        asof="2026-01-23",
    )

    assert updated is True
    assert len(positions) == 1
    position = positions[0]
    assert position.position_id is not None
    assert position.source_order_id == "ORD-TEST-1"

    entry_orders = [o for o in orders if o.order_id == "ORD-TEST-1"]
    assert entry_orders
    assert entry_orders[0].order_kind == "entry"
    assert entry_orders[0].tif == "GTC"
    assert entry_orders[0].position_id == position.position_id

    stop_orders = [o for o in orders if o.order_kind == "stop"]
    assert len(stop_orders) == 1
    stop = stop_orders[0]
    assert stop.position_id == position.position_id
    assert stop.parent_order_id == "ORD-TEST-1"
