import json

import pytest
from fastapi.testclient import TestClient

from api.models.screener import TaxonomyFilter


@pytest.fixture
def pool_client(tmp_path):
    from api.main import app
    from api.dependencies import get_symbol_pool_repo, get_review_queue_repo
    from api.repositories.symbol_pool_repo import SymbolPoolRepository
    from api.repositories.review_queue_repo import ReviewQueueRepository

    pool_path = tmp_path / "symbol_pool.json"
    pool_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "asof": "2026-06-30",
                "symbols": [
                    {"symbol": "AAPL", "region": "us"},
                    {"symbol": "MSFT", "region": "us"},
                    {"symbol": "ASML", "region": "europe"},
                ],
            }
        ),
        encoding="utf-8",
    )
    queue_path = tmp_path / "review_queue.json"
    queue_path.write_text(
        json.dumps({"symbols": {"AAPL": {"symbol": "AAPL", "fetch_failure_count": 3}}}),
        encoding="utf-8",
    )

    app.dependency_overrides[get_symbol_pool_repo] = lambda: SymbolPoolRepository(
        pool_path
    )
    app.dependency_overrides[get_review_queue_repo] = lambda: ReviewQueueRepository(
        queue_path
    )
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_taxonomy_filter_to_spec():
    tf = TaxonomyFilter(
        region=["us"], market_cap_tier=["large", "mid"], provider=["yfinance"]
    )
    spec = tf.to_spec()
    assert spec.region == ("us",)
    assert spec.market_cap_tier == ("large", "mid")
    assert spec.provider == ("yfinance",)
    assert spec.sector is None


def test_load_taxonomy_presets_returns_seeded_presets():
    from api.services.pool_service import load_taxonomy_presets

    presets = load_taxonomy_presets()
    ids = {p["id"] for p in presets}
    assert "us_large_cap_equities" in ids


def test_get_presets_endpoint(pool_client):
    resp = pool_client.get("/api/pool/presets")
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.json()["presets"]}
    assert "us_large_cap_equities" in ids


def test_get_symbols_filters_and_paginates(pool_client):
    resp = pool_client.get("/api/pool/symbols", params={"region": "us", "page_size": 1})
    assert resp.status_code == 200
    body = resp.json()
    assert body["page_size"] == 1
    assert body["total"] == 2  # AAPL + MSFT are us; ASML is europe
    assert all(s["region"] == "us" for s in body["symbols"])
    assert len(body["symbols"]) == 1


def test_review_queue_list_remove_restore(pool_client):
    assert pool_client.get("/api/pool/review-queue").json()["entries"]
    assert (
        pool_client.post("/api/pool/review-queue/AAPL/restore").json()["restored"]
        is True
    )
    assert pool_client.get("/api/pool/review-queue").json()["entries"] == []


def test_review_queue_remove(pool_client):
    assert (
        pool_client.post("/api/pool/review-queue/AAPL/remove").json()["removed"] is True
    )
    assert (
        pool_client.post("/api/pool/review-queue/AAPL/remove").json()["removed"]
        is False
    )
