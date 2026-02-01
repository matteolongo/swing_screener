from __future__ import annotations

import json

from swing_screener.api.service import apply_to_files, load_orders


def test_apply_to_files_noop_keeps_files_unchanged(tmp_path):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"

    orders_payload = {
        "asof": "2026-01-21",
        "orders": [
            {
                "order_id": "AAA-1",
                "ticker": "AAA",
                "status": "pending",
                "order_type": "BUY_LIMIT",
                "limit_price": 10.0,
                "quantity": 1,
                "stop_price": 9.0,
                "order_date": "2026-01-01",
                "filled_date": "",
                "entry_price": None,
                "notes": "",
                "locked": False,
            }
        ],
    }
    positions_payload = {
        "asof": "2026-01-21",
        "positions": [
            {
                "ticker": "AAA",
                "status": "open",
                "entry_date": "2026-01-01",
                "entry_price": 10.0,
                "stop_price": 9.0,
                "shares": 1,
                "notes": "",
                "locked": False,
            }
        ],
    }

    orders_path.write_text(json.dumps(orders_payload, indent=2), encoding="utf-8")
    positions_path.write_text(json.dumps(positions_payload, indent=2), encoding="utf-8")
    before_orders = orders_path.read_text(encoding="utf-8")
    before_positions = positions_path.read_text(encoding="utf-8")

    result = apply_to_files(
        orders_path,
        positions_path,
        order_patches=[],
        position_patches=[],
    )

    assert result["success"] is True
    assert result["asof"] == "2026-01-21"
    assert orders_path.read_text(encoding="utf-8") == before_orders
    assert positions_path.read_text(encoding="utf-8") == before_positions


def test_load_orders_invalid_order_type_normalized_to_empty(tmp_path):
    orders_path = tmp_path / "orders.json"
    payload = {
        "asof": "2026-01-21",
        "orders": [
            {
                "order_id": "AAA-1",
                "ticker": "AAA",
                "status": "pending",
                "order_type": "BUY_MARKET",
                "order_date": "2026-01-01",
                "filled_date": "",
            }
        ],
    }
    orders_path.write_text(json.dumps(payload), encoding="utf-8")

    orders, _ = load_orders(orders_path)

    assert len(orders) == 1
    assert orders[0]["order_type"] == ""
