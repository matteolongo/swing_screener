"""Unit tests for PortfolioService."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from api.services.portfolio_service import PortfolioService
from api.repositories.positions_repo import PositionsRepository


def _make_service(positions_file: Path) -> PortfolioService:
    provider = MagicMock()
    provider.fetch_ohlcv.return_value = MagicMock(empty=True)
    return PortfolioService(
        positions_repo=PositionsRepository(positions_file),
        provider=provider,
    )


def test_realized_pnl_deducts_entry_fee(tmp_path: Path) -> None:
    """Closed position P&L must subtract both entry and exit fees."""
    positions_file = tmp_path / "positions.json"
    positions_file.write_text(
        json.dumps({
            "asof": "2026-05-01",
            "positions": [{
                "ticker": "AAPL",
                "status": "closed",
                "position_id": "POS-001",
                "entry_date": "2026-04-01",
                "entry_price": 100.0,
                "exit_price": 110.0,
                "stop_price": 95.0,
                "shares": 10,
                "entry_fee_eur": 2.0,
                "exit_fee_eur": 2.0,
            }],
        }),
        encoding="utf-8",
    )

    svc = _make_service(positions_file)
    # gross P&L = (110-100) * 10 = 100; fees = 2+2 = 4; net = 96
    assert svc._realized_pnl() == pytest.approx(96.0)
