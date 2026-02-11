"""Test stop order synchronization when position stop is updated."""
import pytest
from unittest.mock import MagicMock
import pandas as pd

from api.services.portfolio_service import PortfolioService
from api.models.portfolio import UpdateStopRequest
from swing_screener.data.providers import MarketDataProvider


@pytest.fixture
def mock_provider():
    """Mock market data provider."""
    provider = MagicMock(spec=MarketDataProvider)
    
    # Mock OHLCV data
    dates = pd.date_range("2026-02-01", "2026-02-11", freq="D")
    ohlcv = pd.DataFrame(
        {
            ("Close", "AAPL"): [150.0] * len(dates),
        },
        index=dates
    )
    provider.fetch_ohlcv.return_value = ohlcv
    
    return provider


@pytest.fixture
def temp_positions_file(tmp_path):
    """Create temporary positions file."""
    positions_file = tmp_path / "positions.json"
    positions_data = {
        "asof": "2026-02-11",
        "positions": [
            {
                "position_id": "POS-001",
                "ticker": "AAPL",
                "status": "open",
                "entry_date": "2026-02-01",
                "entry_price": 145.0,
                "stop_price": 140.0,
                "shares": 50,
                "exit_order_ids": ["ORD-STOP-001"],
                "notes": ""
            }
        ]
    }
    
    import json
    with open(positions_file, "w") as f:
        json.dump(positions_data, f)
    
    return positions_file


@pytest.fixture
def temp_orders_file(tmp_path):
    """Create temporary orders file."""
    orders_file = tmp_path / "orders.json"
    orders_data = {
        "asof": "2026-02-11",
        "orders": [
            {
                "order_id": "ORD-STOP-001",
                "ticker": "AAPL",
                "status": "pending",
                "order_type": "STOP",
                "quantity": 50,
                "stop_price": 140.0,
                "order_date": "2026-02-01",
                "notes": "Initial stop order",
                "order_kind": "stop",
                "position_id": "POS-001",
                "tif": "GTC"
            }
        ]
    }
    
    import json
    with open(orders_file, "w") as f:
        json.dump(orders_data, f)
    
    return orders_file


def test_update_stop_cancels_old_order_and_creates_new(
    mock_provider,
    temp_positions_file,
    temp_orders_file
):
    """Test that updating position stop cancels old SELL_STOP and creates new one."""
    from api.repositories.positions_repo import PositionsRepository
    from api.repositories.orders_repo import OrdersRepository
    from pathlib import Path
    
    positions_repo = PositionsRepository(Path(temp_positions_file))
    orders_repo = OrdersRepository(Path(temp_orders_file))
    
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=mock_provider
    )
    
    # Update stop from 140 to 142
    request = UpdateStopRequest(new_stop=142.0, reason="Trailing stop update")
    result = service.update_position_stop("POS-001", request)
    
    # Verify response
    assert result["status"] == "ok"
    assert result["position_id"] == "POS-001"
    assert result["new_stop"] == 142.0
    assert result["old_stop"] == 140.0
    assert len(result["cancelled_orders"]) == 1
    assert result["cancelled_orders"][0] == "ORD-STOP-001"
    assert result["new_order_id"] is not None
    
    # Verify position updated
    positions_data = positions_repo.read()
    position = positions_data["positions"][0]
    assert position["stop_price"] == 142.0
    assert "Trailing stop update" in position["notes"]
    assert result["new_order_id"] in position["exit_order_ids"]
    
    # Verify orders updated
    orders_data = orders_repo.read()
    orders = orders_data["orders"]
    
    # Old order should be cancelled
    old_order = [o for o in orders if o["order_id"] == "ORD-STOP-001"][0]
    assert old_order["status"] == "cancelled"
    assert "Replaced with new stop at 142" in old_order["notes"]
    
    # New order should exist
    new_order = [o for o in orders if o["order_id"] == result["new_order_id"]][0]
    assert new_order["status"] == "pending"
    assert new_order["order_type"] == "STOP"
    assert new_order["stop_price"] == 142.0
    assert new_order["quantity"] == 50
    assert new_order["ticker"] == "AAPL"
    assert new_order["order_kind"] == "stop"
    assert new_order["position_id"] == "POS-001"
    assert new_order["tif"] == "GTC"


def test_update_stop_no_existing_order_creates_new(
    mock_provider,
    temp_positions_file,
    tmp_path
):
    """Test that updating stop creates new order if no existing stop order."""
    from api.repositories.positions_repo import PositionsRepository
    from api.repositories.orders_repo import OrdersRepository
    from pathlib import Path
    
    # Create orders file with NO stop orders
    orders_file = tmp_path / "orders_empty.json"
    import json
    with open(orders_file, "w") as f:
        json.dump({"asof": "2026-02-11", "orders": []}, f)
    
    positions_repo = PositionsRepository(Path(temp_positions_file))
    orders_repo = OrdersRepository(Path(orders_file))
    
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=mock_provider
    )
    
    # Update stop
    request = UpdateStopRequest(new_stop=142.0, reason="First trailing stop")
    result = service.update_position_stop("POS-001", request)
    
    # Should create new order even though there was no existing one
    assert result["cancelled_orders"] == []
    assert result["new_order_id"] is not None
    
    # Verify new order created
    orders_data = orders_repo.read()
    assert len(orders_data["orders"]) == 1
    new_order = orders_data["orders"][0]
    assert new_order["stop_price"] == 142.0
    assert new_order["status"] == "pending"


def test_update_stop_validation_still_works(
    mock_provider,
    temp_positions_file,
    temp_orders_file
):
    """Test that validation (can't move down, can't exceed entry) still works."""
    from api.repositories.positions_repo import PositionsRepository
    from api.repositories.orders_repo import OrdersRepository
    from pathlib import Path
    from fastapi import HTTPException
    
    positions_repo = PositionsRepository(Path(temp_positions_file))
    orders_repo = OrdersRepository(Path(temp_orders_file))
    
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=mock_provider
    )
    
    # Try to move stop down - should fail
    request_down = UpdateStopRequest(new_stop=138.0, reason="Bad move")
    with pytest.raises(HTTPException) as exc:
        service.update_position_stop("POS-001", request_down)
    assert "Cannot move stop down" in str(exc.value.detail)
    
    # Try to move stop above entry - should fail
    request_above = UpdateStopRequest(new_stop=146.0, reason="Too high")
    with pytest.raises(HTTPException) as exc:
        service.update_position_stop("POS-001", request_above)
    assert "must be below entry price" in str(exc.value.detail)


def test_update_stop_only_cancels_pending_orders(
    mock_provider,
    temp_positions_file,
    tmp_path
):
    """Test that only PENDING stop orders are cancelled, not filled/cancelled ones."""
    from api.repositories.positions_repo import PositionsRepository
    from api.repositories.orders_repo import OrdersRepository
    from pathlib import Path
    
    # Create orders file with multiple stop orders in different states
    orders_file = tmp_path / "orders_multi.json"
    orders_data = {
        "asof": "2026-02-11",
        "orders": [
            {
                "order_id": "ORD-STOP-OLD",
                "ticker": "AAPL",
                "status": "cancelled",  # Already cancelled
                "order_type": "STOP",
                "quantity": 50,
                "stop_price": 135.0,
                "order_kind": "stop",
                "position_id": "POS-001",
            },
            {
                "order_id": "ORD-STOP-CURRENT",
                "ticker": "AAPL",
                "status": "pending",  # Active
                "order_type": "STOP",
                "quantity": 50,
                "stop_price": 140.0,
                "order_kind": "stop",
                "position_id": "POS-001",
            }
        ]
    }
    
    import json
    with open(orders_file, "w") as f:
        json.dump(orders_data, f)
    
    positions_repo = PositionsRepository(Path(temp_positions_file))
    orders_repo = OrdersRepository(Path(orders_file))
    
    service = PortfolioService(
        orders_repo=orders_repo,
        positions_repo=positions_repo,
        provider=mock_provider
    )
    
    request = UpdateStopRequest(new_stop=142.0, reason="Trail")
    result = service.update_position_stop("POS-001", request)
    
    # Should only cancel the PENDING order
    assert len(result["cancelled_orders"]) == 1
    assert result["cancelled_orders"][0] == "ORD-STOP-CURRENT"
    
    # Old cancelled order should remain cancelled
    orders_data = orders_repo.read()
    old_order = [o for o in orders_data["orders"] if o["order_id"] == "ORD-STOP-OLD"][0]
    assert old_order["status"] == "cancelled"
