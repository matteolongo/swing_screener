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


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("POST", "partial-close", {"shares_closed": 2, "price": 110}),
        ("POST", "close", {"exit_price": 110}),
        ("PUT", "stop", {"new_stop": 97}),
        ("PATCH", "trail-method", {"trail_method": "manual"}),
    ],
)
def test_stale_position_version_rejects_write_without_changing_ledger(
    client, monkeypatch, method, path, payload
):
    from api.services.portfolio.write import PortfolioWriteService, PreparedStopUpdate

    # Market validation is orthogonal to the version guard and stays offline.
    monkeypatch.setattr(
        PortfolioWriteService,
        "prepare_position_stop",
        lambda self, position_id, request: PreparedStopUpdate(
            position_id, request, 95, request.new_stop
        ),
    )
    created = client.post(
        "/api/portfolio/positions",
        json=_manual_position_payload(),
        headers={"Idempotency-Key": "version-create"},
    ).json()
    position_id = created["position_id"]
    first = client.post(
        f"/api/portfolio/positions/{position_id}/partial-close",
        json={"shares_closed": 5, "price": 110, "expected_version": created["version"]},
        headers={"Idempotency-Key": "version-first-exit"},
    )
    assert first.status_code == 200, first.text
    before = client.get(f"/api/portfolio/positions/{position_id}").json()
    orders_before = client.get("/api/portfolio/orders/local").json()

    stale = client.request(
        method,
        f"/api/portfolio/positions/{position_id}/{path}",
        json={**payload, "expected_version": created["version"]},
        headers={"Idempotency-Key": f"version-stale-{path}"},
    )

    assert stale.status_code == 409
    assert client.get(f"/api/portfolio/positions/{position_id}").json() == before
    assert client.get("/api/portfolio/orders/local").json() == orders_before


def test_versioned_partial_close_retry_replays_before_old_version_rejection(client):
    created = client.post(
        "/api/portfolio/positions",
        json=_manual_position_payload(),
        headers={"Idempotency-Key": "version-replay-create"},
    ).json()
    position_id = created["position_id"]
    payload = {"shares_closed": 5, "price": 110, "expected_version": created["version"]}
    headers = {"Idempotency-Key": "version-replay-exit"}
    first = client.post(
        f"/api/portfolio/positions/{position_id}/partial-close",
        json=payload,
        headers=headers,
    )
    retry = client.post(
        f"/api/portfolio/positions/{position_id}/partial-close",
        json=payload,
        headers=headers,
    )
    assert first.status_code == retry.status_code == 200
    assert retry.json() == first.json()
    assert client.get(f"/api/portfolio/positions/{position_id}").json()["shares"] == 5


def test_optional_version_preserves_legacy_idempotency_hash():
    from api.services.portfolio_service import PortfolioService

    assert (
        PortfolioService._idempotency_hash(
            subject="local",
            operation="update_position_stop",
            resource="P1",
            body={"new_stop": 97, "reason": "", "expected_version": None},
        )
        == "de7f0857896fc97ec58495214622dea6c2fbd704005b96e9880d64090d4a0617"
    )


def test_stale_stop_version_precedes_snapshot_price_validation(client):
    created = client.post(
        "/api/portfolio/positions",
        json=_manual_position_payload(),
        headers={"Idempotency-Key": "stale-stop-create"},
    ).json()
    position_id = created["position_id"]
    assert (
        client.post(
            f"/api/portfolio/positions/{position_id}/partial-close",
            json={"shares_closed": 5, "price": 110},
            headers={"Idempotency-Key": "stale-stop-partial"},
        ).status_code
        == 200
    )
    response = client.put(
        f"/api/portfolio/positions/{position_id}/stop",
        json={"new_stop": 94, "expected_version": 1},
        headers={"Idempotency-Key": "stale-stop-update"},
    )
    assert response.status_code == 409, response.text


def test_trail_update_returns_current_version_for_followup_stop_request(client):
    created = client.post(
        "/api/portfolio/positions",
        json=_manual_position_payload(),
        headers={"Idempotency-Key": "trail-version-create"},
    ).json()
    response = client.patch(
        f"/api/portfolio/positions/{created['position_id']}/trail-method",
        json={"trail_method": "manual", "expected_version": created["version"]},
        headers={"Idempotency-Key": "trail-version-update"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["position_version"] == 2


def test_competing_versioned_partial_exits_only_apply_once(client):
    created = client.post(
        "/api/portfolio/positions", json=_manual_position_payload(),
        headers={"Idempotency-Key": "competing-version-create"},
    ).json()
    position_id = created["position_id"]

    def partial(index):
        return client.post(
            f"/api/portfolio/positions/{position_id}/partial-close",
            json={"shares_closed": 3, "price": 110, "expected_version": 1},
            headers={"Idempotency-Key": f"competing-version-exit-{index}"},
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(partial, range(2)))
    assert sorted(response.status_code for response in responses) == [200, 409]
    position = client.get(f"/api/portfolio/positions/{position_id}").json()
    assert position["version"] == 2
    assert position["shares"] == 7
    assert len(position["partial_closes"]) == 1
