from __future__ import annotations

import json
from pathlib import Path

import pytest

from swing_screener.api.service import (
    PatchError,
    apply_patches,
    apply_to_files,
    build_diff,
    load_orders,
    load_positions,
)


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def test_apply_patches_respects_lock() -> None:
    orders = [
        {
            "order_id": "AAA-1",
            "ticker": "AAA",
            "status": "pending",
            "locked": True,
        }
    ]
    positions = [{"ticker": "AAA", "status": "open", "locked": False}]

    with pytest.raises(PatchError):
        apply_patches(
            orders,
            positions,
            order_patches=[{"order_id": "AAA-1", "status": "filled"}],
        )


def test_lock_propagates_to_orders_and_positions() -> None:
    orders = [
        {"order_id": "AAA-1", "ticker": "AAA", "status": "pending", "locked": False},
        {"order_id": "AAA-2", "ticker": "AAA", "status": "pending", "locked": False},
    ]
    positions = [{"ticker": "AAA", "status": "open", "locked": False}]

    updated_orders, updated_positions = apply_patches(
        orders,
        positions,
        order_patches=[{"order_id": "AAA-1", "locked": True}],
    )

    assert all(o["locked"] is True for o in updated_orders)
    assert updated_positions[0]["locked"] is True


def test_build_diff_detects_changes() -> None:
    orders = [{"order_id": "AAA-1", "ticker": "AAA", "status": "pending", "locked": False}]
    positions = [{"ticker": "AAA", "status": "open", "stop_price": 10.0, "locked": False}]

    updated_orders = [{"order_id": "AAA-1", "ticker": "AAA", "status": "filled", "locked": False}]
    updated_positions = [
        {"ticker": "AAA", "status": "open", "stop_price": 9.5, "locked": False}
    ]

    diff = build_diff(orders, positions, updated_orders, updated_positions)
    assert diff["diff"]["orders"][0]["changes"]["status"] == ["pending", "filled"]
    assert diff["diff"]["positions"][0]["changes"]["stop_price"] == [10.0, 9.5]


def test_apply_to_files_writes_outputs(tmp_path: Path) -> None:
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"

    _write_json(
        orders_path,
        {
            "asof": "2026-01-21",
            "orders": [{"order_id": "AAA-1", "ticker": "AAA", "status": "pending"}],
        },
    )
    _write_json(
        positions_path,
        {
            "asof": "2026-01-21",
            "positions": [{"ticker": "AAA", "status": "open", "stop_price": 10.0}],
        },
    )

    result = apply_to_files(
        orders_path,
        positions_path,
        order_patches=[{"order_id": "AAA-1", "status": "filled"}],
        position_patches=[{"ticker": "AAA", "stop_price": 9.5}],
    )

    assert result["success"] is True
    new_orders, _ = load_orders(orders_path)
    new_positions, _ = load_positions(positions_path)
    assert new_orders[0]["status"] == "filled"
    assert new_positions[0]["stop_price"] == 9.5
