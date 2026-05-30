from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import api.dependencies
import api.routers.portfolio as portfolio_router
from api.main import app


class _DummyDegiroAPI:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def get_update(self, request_list, raw=True):  # noqa: ANN001
        option = request_list[0].option.name
        self.calls.append(f"get_update:{option}")
        if option == "PORTFOLIO":
            return {"portfolio": {"value": []}}
        if option == "TOTAL_PORTFOLIO":
            return {"portfolio": {"value": []}}
        if option == "ORDERS":
            return {"orders": {"value": []}}
        return {}

    def get_orders_history(self, history_request, raw=True):  # noqa: ANN001
        self.calls.append("get_orders_history")
        return {
            "data": [
                {
                    "orderId": "DEGIRO-EXIT-1",
                    "productId": 12345,
                    "buysell": "S",
                    "size": 10,
                    "price": 35.0,
                    "date": "2026-04-16",
                }
            ]
        }

    def get_transactions_history(self, transaction_request, raw=True):  # noqa: ANN001
        self.calls.append("get_transactions_history")
        return {
            "data": [
                {
                    "orderId": "DEGIRO-EXIT-1",
                    "productId": 12345,
                    "buysell": "S",
                    "quantity": -10,
                    "price": 35.0,
                    "feeInBaseCurrency": 0.2,
                    "date": "2026-04-16",
                }
            ]
        }

    def get_products_info(self, product_list, raw=True):  # noqa: ANN001
        self.calls.append("get_products_info")
        return {
            "data": {
                "12345": {
                    "id": 12345,
                    "symbol": "SBMO",
                    "isin": "NL0010547661",
                    "name": "SBM Offshore NV",
                }
            }
        }


class _DummyDegiroClient:
    def __init__(self, credentials) -> None:  # noqa: ANN001
        self.api = _DummyDegiroAPI()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):  # noqa: ANN001
        return False


def test_degiro_sync_apply_closes_matching_open_position(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    positions_file = tmp_path / "positions.json"
    positions_file.write_text(
        json.dumps(
            {
                "asof": "2026-04-15",
                "positions": [
                    {
                        "ticker": "SBMO.AS",
                        "status": "open",
                        "position_id": "POS-SBMO.AS-20260326-01",
                        "source_order_id": "SBMO.AS-20260325233718",
                        "entry_date": "2026-03-26",
                        "entry_price": 34.64,
                        "stop_price": 35.0,
                        "shares": 10,
                        "notes": "From screener",
                        "broker": None,
                        "broker_product_id": None,
                        "isin": None,
                        "broker_synced_at": None,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(api.dependencies, "POSITIONS_FILE", positions_file)
    monkeypatch.setattr(portfolio_router, "_check_degiro_available", lambda: None)
    monkeypatch.setattr(
        "swing_screener.integrations.degiro.credentials.load_credentials",
        lambda: SimpleNamespace(username="demo"),
    )
    monkeypatch.setattr(
        "swing_screener.integrations.degiro.client.DegiroClient",
        _DummyDegiroClient,
    )

    client = TestClient(app)
    response = client.post(
        "/api/portfolio/sync/degiro/apply",
        json={
            "from_date": "2026-03-01",
            "to_date": "2026-04-16",
            "include_portfolio": True,
            "include_orders_history": True,
            "include_transactions": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["positions_updated"] == 1
    assert payload["orders_updated"] == 1

    stored = json.loads(positions_file.read_text(encoding="utf-8"))
    updated = stored["positions"][0]
    assert updated["status"] == "closed"
    assert updated["exit_date"] == "2026-04-16"
    assert updated["exit_price"] == 35.0
    assert updated["exit_fee_eur"] == pytest.approx(0.2)
    assert updated["broker"] == "degiro"
    assert updated["broker_synced_at"] is not None
    assert "Closed via DeGiro sync" in updated["notes"]

