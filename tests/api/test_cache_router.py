"""Tests for the /api/cache endpoints."""
from __future__ import annotations

import json

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


def test_scan_dir_returns_none_for_dir_with_only_subdirs(tmp_path):
    """_scan_dir (and _mtime_iso) must not raise when a dir contains only subdirs, no files."""
    from api.services.cache_service import _scan_dir, _ID_TO_DEF
    subdir = tmp_path / "subdir"
    subdir.mkdir()
    original_path = _ID_TO_DEF["intelligence_evidence"]["path"]
    _ID_TO_DEF["intelligence_evidence"]["path"] = str(tmp_path)
    try:
        iso, count = _scan_dir(str(tmp_path), ".json")
        assert iso is None
        assert count == 0
    finally:
        _ID_TO_DEF["intelligence_evidence"]["path"] = original_path


def test_ttl_description_reads_from_config():
    """status() derives ticker_meta/ohlcv_polygon TTL labels from config, not hardcoded literals."""
    from unittest.mock import MagicMock, patch
    from api.services.cache_service import CacheService

    mock_mgr = MagicMock()
    mock_mgr.load_user_document.return_value = {
        "cache": {"ticker_meta_ttl_days": 14, "polygon_cache_ttl_days": 3}
    }
    with patch("api.services.cache_service.get_settings_manager", return_value=mock_mgr):
        entries = CacheService().status()

    by_id = {e.id: e for e in entries}
    assert by_id["ticker_meta"].ttl_description == "14 days"
    assert by_id["ohlcv_polygon"].ttl_description == "3 days"


def test_ttl_description_falls_back_to_defaults_on_empty_config():
    """status() falls back to '30 days'/'7 days' when config returns empty cache block."""
    from unittest.mock import MagicMock, patch
    from api.services.cache_service import CacheService

    mock_mgr = MagicMock()
    mock_mgr.load_user_document.return_value = {}
    with patch("api.services.cache_service.get_settings_manager", return_value=mock_mgr):
        entries = CacheService().status()

    by_id = {e.id: e for e in entries}
    assert by_id["ticker_meta"].ttl_description == "30 days"
    assert by_id["ohlcv_polygon"].ttl_description == "7 days"
