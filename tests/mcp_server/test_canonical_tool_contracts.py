from __future__ import annotations

import asyncio

from mcp_server.tools.portfolio.fill_order import FillOrderTool
from mcp_server.tools.portfolio.update_position_stop import UpdatePositionStopTool
from mcp_server.tools.screener.preview_order import PreviewOrderTool


def test_preview_order_requires_canonical_ticker_argument():
    result = asyncio.run(
        PreviewOrderTool().execute(
            {
                "entry_price": 100.0,
                "stop_price": 95.0,
            }
        )
    )

    assert result["error"] == "ticker, entry_price, and stop_price are required"


def test_fill_order_rejects_legacy_fill_argument_names():
    result = asyncio.run(
        FillOrderTool().execute(
            {
                "order_id": "ORD-1",
                "fill_price": 100.0,
                "fill_date": "2026-03-17",
            }
        )
    )

    assert result["error"] == "order_id, filled_price, and filled_date are required"


def test_update_position_stop_rejects_legacy_stop_argument_name():
    result = asyncio.run(
        UpdatePositionStopTool().execute(
            {
                "position_id": "POS-1",
                "new_stop_price": 95.0,
            }
        )
    )

    assert result["error"] == "position_id and new_stop are required"
