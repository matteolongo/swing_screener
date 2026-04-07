from __future__ import annotations

import asyncio

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
