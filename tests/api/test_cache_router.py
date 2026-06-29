"""Tests for the /api/cache endpoints."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_get_cache_status_returns_list():
    resp = client.get("/api/cache/status")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_cache_status_schema():
    resp = client.get("/api/cache/status")
    assert resp.status_code == 200
    entry = resp.json()[0]
    assert "id" in entry
    assert "label" in entry
    assert "storage" in entry
    assert "ttl_description" in entry
    assert "can_clear" in entry
    assert "last_modified_at" in entry
    assert "entry_count" in entry


def test_get_cache_status_known_ids():
    resp = client.get("/api/cache/status")
    ids = {e["id"] for e in resp.json()}
    assert "ticker_meta" in ids
    assert "ohlcv_yfinance" in ids
    assert "screener_eval" in ids


def test_clear_unknown_cache_returns_400():
    resp = client.post("/api/cache/clear/does_not_exist")
    assert resp.status_code == 400


def test_clear_memory_cache_returns_400():
    resp = client.post("/api/cache/clear/currency_lru")
    assert resp.status_code == 400


def test_clear_json_cache_writes_empty_dict(tmp_path):
    cache_file = tmp_path / "ticker_meta.json"
    cache_file.write_text(json.dumps({"AAPL": {"name": "Apple"}}))

    from api.services.cache_service import CacheService, _ID_TO_DEF
    original_path = _ID_TO_DEF["ticker_meta"]["path"]
    _ID_TO_DEF["ticker_meta"]["path"] = str(cache_file)
    try:
        service = CacheService()
        service.clear("ticker_meta")
        assert json.loads(cache_file.read_text()) == {}
    finally:
        _ID_TO_DEF["ticker_meta"]["path"] = original_path
