from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from swing_screener.intelligence.cache import read_from_cache, write_to_cache
from swing_screener.intelligence.models import SymbolIntelligence


def _make_intel(symbol: str = "AAPL") -> SymbolIntelligence:
    return SymbolIntelligence(
        symbol=symbol,
        generated_at="2026-05-24T10:00:00Z",
        action="BUY_NOW",
        conviction="high",
        catalyst_urgency="medium",
        summary_line="Strong setup.",
        narrative="## Why\nText.",
        upcoming_events=[],
        position_signal=None,
        sources=[],
    )


def test_write_and_read_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    intel = _make_intel("AAPL")
    write_to_cache("AAPL", intel, for_date=d)
    result = read_from_cache("AAPL", for_date=d)
    assert result is not None
    assert result.symbol == "AAPL"
    assert result.action == "BUY_NOW"
    assert result.catalyst_urgency == "medium"


def test_read_returns_none_for_missing_ticker(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("AAPL", _make_intel("AAPL"), for_date=d)
    result = read_from_cache("MSFT", for_date=d)
    assert result is None


def test_read_returns_none_for_different_date(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    write_to_cache("AAPL", _make_intel(), for_date=date(2026, 5, 23))
    result = read_from_cache("AAPL", for_date=date(2026, 5, 24))
    assert result is None


def test_write_is_case_insensitive(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("aapl", _make_intel("AAPL"), for_date=d)
    result = read_from_cache("AAPL", for_date=d)
    assert result is not None


def test_write_updates_existing_entry(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("AAPL", _make_intel(), for_date=d)
    updated = _make_intel()
    updated = updated.model_copy(update={"summary_line": "Updated summary."})
    write_to_cache("AAPL", updated, for_date=d)
    result = read_from_cache("AAPL", for_date=d)
    assert result is not None
    assert result.summary_line == "Updated summary."


def test_multiple_tickers_in_same_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("AAPL", _make_intel("AAPL"), for_date=d)
    write_to_cache("MSFT", _make_intel("MSFT"), for_date=d)
    cache_file = tmp_path / "intelligence" / "sweep_2026-05-24.json"
    data = json.loads(cache_file.read_text())
    assert "AAPL" in data
    assert "MSFT" in data
