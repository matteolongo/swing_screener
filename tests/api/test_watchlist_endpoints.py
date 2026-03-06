import json

import pytest
from fastapi.testclient import TestClient

import api.dependencies
from api.main import app


def test_watchlist_crud_and_idempotent_upsert(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    watchlist_file = tmp_path / "watchlist.json"
    monkeypatch.setattr(api.dependencies, "WATCHLIST_FILE", watchlist_file)

    client = TestClient(app)

    empty = client.get("/api/watchlist")
    assert empty.status_code == 200
    assert empty.json() == {"items": []}

    created = client.put(
        "/api/watchlist/aapl",
        json={"watch_price": 182.45, "currency": "usd", "source": "screener"},
    )
    assert created.status_code == 200
    created_payload = created.json()
    assert created_payload["ticker"] == "AAPL"
    assert created_payload["watch_price"] == pytest.approx(182.45)
    assert created_payload["currency"] == "USD"
    assert created_payload["source"] == "screener"
    assert isinstance(created_payload["watched_at"], str)

    listed = client.get("/api/watchlist")
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    # Re-watch must be idempotent and preserve original snapshot.
    rewatch = client.put(
        "/api/watchlist/AAPL",
        json={"watch_price": 190.00, "currency": "EUR", "source": "daily_review_candidates"},
    )
    assert rewatch.status_code == 200
    rewatch_payload = rewatch.json()
    assert rewatch_payload["watched_at"] == created_payload["watched_at"]
    assert rewatch_payload["watch_price"] == pytest.approx(182.45)
    assert rewatch_payload["currency"] == "USD"
    assert rewatch_payload["source"] == "screener"

    deleted = client.delete("/api/watchlist/AAPL")
    assert deleted.status_code == 200
    assert deleted.json() == {"deleted": True}

    listed_after_delete = client.get("/api/watchlist")
    assert listed_after_delete.status_code == 200
    assert listed_after_delete.json() == {"items": []}


def test_watchlist_delete_missing_returns_404(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    watchlist_file = tmp_path / "watchlist.json"
    watchlist_file.write_text(json.dumps({"items": []}), encoding="utf-8")
    monkeypatch.setattr(api.dependencies, "WATCHLIST_FILE", watchlist_file)

    client = TestClient(app)
    response = client.delete("/api/watchlist/MSFT")
    assert response.status_code == 404
    assert response.json()["detail"] == "Watch item not found: MSFT"


@pytest.mark.parametrize(
    "payload",
    [
        {"watch_price": -1, "currency": "USD", "source": "screener"},
        {"watch_price": 150.0, "currency": "USD", "source": "   "},
    ],
)
def test_watchlist_validation_errors(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
    payload: dict,
) -> None:
    watchlist_file = tmp_path / "watchlist.json"
    monkeypatch.setattr(api.dependencies, "WATCHLIST_FILE", watchlist_file)

    client = TestClient(app)
    response = client.put("/api/watchlist/NVDA", json=payload)
    assert response.status_code == 422


def test_watchlist_invalid_ticker_returns_422(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    watchlist_file = tmp_path / "watchlist.json"
    monkeypatch.setattr(api.dependencies, "WATCHLIST_FILE", watchlist_file)

    client = TestClient(app)
    response = client.put(
        "/api/watchlist/AAPL%21",
        json={"watch_price": 180, "currency": "USD", "source": "screener"},
    )
    assert response.status_code == 422

