from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import json

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    orders_path.write_text(
        json.dumps(
            {
                "orders": [
                    {
                        "order_id": "ORD-AAPL-001",
                        "ticker": "AAPL",
                        "status": "pending",
                        "order_kind": "entry",
                        "order_type": "BUY_LIMIT",
                        "quantity": 2,
                        "limit_price": 100,
                        "stop_price": 95,
                        "target_price": 110,
                        "order_date": "2026-07-15",
                        "quote_currency": "USD",
                        "account_currency": "EUR",
                        "approval_fx_rate": 1.1,
                    }
                ],
                "asof": "2026-07-15",
            }
        )
    )
    positions_path.write_text(json.dumps({"positions": [], "asof": "2026-07-15"}))
    import api.dependencies as dependencies

    monkeypatch.setattr(dependencies, "_orders_path", orders_path)
    monkeypatch.setattr(dependencies, "_positions_path", positions_path)
    return TestClient(app)


def test_create_requires_bounded_idempotency_key(client):
    payload = {
        "ticker": "AAPL",
        "order_type": "SELL_STOP",
        "order_kind": "stop",
        "quantity": 2,
        "limit_price": 94,
        "stop_price": 95,
    }
    assert client.post("/api/portfolio/orders", json=payload).status_code == 422
    assert (
        client.post(
            "/api/portfolio/orders",
            json=payload,
            headers={"Idempotency-Key": "x" * 201},
        ).status_code
        == 422
    )


def test_identical_create_retry_returns_original_without_duplicate(client):
    payload = {
        "ticker": "AAPL",
        "order_type": "SELL_STOP",
        "order_kind": "stop",
        "quantity": 2,
        "limit_price": 94,
        "stop_price": 95,
    }
    headers = {"Idempotency-Key": "create-aapl-stop"}

    first = client.post("/api/portfolio/orders", json=payload, headers=headers)
    second = client.post("/api/portfolio/orders", json=payload, headers=headers)

    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    orders = client.get("/api/portfolio/orders/local").json()["orders"]
    assert len([order for order in orders if order["order_kind"] == "stop"]) == 1

    changed = client.post(
        "/api/portfolio/orders",
        json={**payload, "quantity": 3},
        headers=headers,
    )
    assert changed.status_code == 409


def test_identical_fill_retry_returns_original_without_duplicate_position(client):
    headers = {"Idempotency-Key": "fill-aapl-entry"}
    payload = {
        "filled_price": 100,
        "filled_date": "2026-07-15",
        "fill_fx_rate": 1.1,
    }

    first = client.post(
        "/api/portfolio/orders/ORD-AAPL-001/fill", json=payload, headers=headers
    )
    second = client.post(
        "/api/portfolio/orders/ORD-AAPL-001/fill", json=payload, headers=headers
    )

    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    positions = client.get("/api/portfolio/positions").json()["positions"]
    assert len(positions) == 1


def test_concurrent_identical_fill_replays_one_atomic_mutation(client):
    payload = {
        "filled_price": 100,
        "filled_date": "2026-07-15",
        "fill_fx_rate": 1.1,
    }

    def fill():
        return client.post(
            "/api/portfolio/orders/ORD-AAPL-001/fill",
            json=payload,
            headers={"Idempotency-Key": "concurrent-fill"},
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _index: fill(), range(2)))

    assert [response.status_code for response in responses] == [201, 201]
    assert responses[0].json() == responses[1].json()
    positions = client.get("/api/portfolio/positions").json()["positions"]
    assert len(positions) == 1


def _manual_position_payload():
    return {
        "ticker": "MSFT",
        "entry_price": 100,
        "stop_price": 95,
        "shares": 10,
        "entry_date": "2026-07-15",
        "quote_currency": "USD",
        "account_currency": "EUR",
        "entry_fx_rate": 1.1,
    }


def test_position_writes_require_an_idempotency_key(client):
    response = client.post("/api/portfolio/positions", json=_manual_position_payload())

    assert response.status_code == 422


def test_identical_partial_close_retry_replays_without_second_share_reduction(client):
    created = client.post(
        "/api/portfolio/positions",
        json=_manual_position_payload(),
        headers={"Idempotency-Key": "create-msft-position"},
    )
    assert created.status_code == 200
    position_id = created.json()["position_id"]
    payload = {"shares_closed": 3, "price": 110, "fee_eur": 0.5, "fx_rate": 1.1}
    headers = {"Idempotency-Key": "partial-close-msft"}

    first = client.post(
        f"/api/portfolio/positions/{position_id}/partial-close",
        json=payload,
        headers=headers,
    )
    second = client.post(
        f"/api/portfolio/positions/{position_id}/partial-close",
        json=payload,
        headers=headers,
    )

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    position = client.get(f"/api/portfolio/positions/{position_id}").json()
    assert position["shares"] == 7
    assert len(position["partial_closes"]) == 1


def test_reusing_key_for_another_operation_returns_conflict(client):
    key = {"Idempotency-Key": "cross-operation-key"}
    created = client.post(
        "/api/portfolio/orders",
        json={
            "ticker": "AAPL",
            "order_type": "SELL_STOP",
            "order_kind": "stop",
            "quantity": 2,
            "limit_price": 94,
            "stop_price": 95,
        },
        headers=key,
    )
    assert created.status_code == 201

    fill = client.post(
        "/api/portfolio/orders/ORD-AAPL-001/fill",
        json={
            "filled_price": 100,
            "filled_date": "2026-07-15",
            "fill_fx_rate": 1.1,
        },
        headers=key,
    )

    assert fill.status_code == 409
