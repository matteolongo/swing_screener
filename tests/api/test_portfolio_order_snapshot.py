import pytest
import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
import api.repositories.orders_repo as orders_repo
import api.services.portfolio_service as portfolio_service


def _ohlcv_for_tickers() -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=2, freq="D")
    data = {
        ("Close", "AAPL"): [100.0, 105.0],
        ("Open", "AAPL"): [99.0, 104.0],
        ("High", "AAPL"): [101.0, 106.0],
        ("Low", "AAPL"): [98.0, 103.0],
        ("Volume", "AAPL"): [1_000_000, 1_100_000],
    }
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_order_snapshot_includes_last_price_and_distance(monkeypatch, tmp_path):
    # Create temporary orders file
    orders_file = tmp_path / "orders.json"
    import json
    orders_data = {
        "asof": "2026-02-08",
        "orders": [
            {
                "order_id": "ORD-AAPL-1",
                "ticker": "AAPL",
                "status": "pending",
                "order_type": "BUY_LIMIT",
                "quantity": 10,
                "limit_price": 100.0,
                "stop_price": 90.0,
                "order_kind": "entry",
            }
        ],
    }
    orders_file.write_text(json.dumps(orders_data))

    def fake_fetch_ohlcv(tickers, cfg):
        return _ohlcv_for_tickers()

    # Patch the get_orders_path dependency to return our test file
    import api.dependencies
    monkeypatch.setattr(api.dependencies, "ORDERS_FILE", orders_file)
    monkeypatch.setattr(portfolio_service, "fetch_ohlcv", fake_fetch_ohlcv)

    client = TestClient(app)
    res = client.get("/api/portfolio/orders/snapshot")
    assert res.status_code == 200
    data = res.json()
    # asof date will be today's date from get_today_str()
    assert "asof" in data
    assert len(data["orders"]) == 1
    order = data["orders"][0]
    assert order["ticker"] == "AAPL"
    assert order["last_price"] == 105.0
    assert order["last_bar"] == "2024-01-02T00:00:00"
    assert order["pct_to_limit"] == pytest.approx(-4.7619, rel=1e-3)
    assert order["pct_to_stop"] == pytest.approx(-14.2857, rel=1e-3)
