from __future__ import annotations

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from swing_screener.intelligence.cache import (
    read_from_cache,
    read_latest_from_cache,
    write_to_cache,
)
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
    cache_file = tmp_path / "intelligence" / "sweep_2026-05-24.json"
    data = json.loads(cache_file.read_text())
    assert data["AAPL"]["_cache_schema_version"] == 3


def test_read_rejects_incompatible_context_fingerprint(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    intel = _make_intel("AAPL").model_copy(update={"context_fingerprint": "one"})
    write_to_cache("AAPL", intel, for_date=d)

    assert read_from_cache("AAPL", for_date=d, expected_fingerprint="two") is None
    assert read_from_cache("AAPL", for_date=d, expected_fingerprint="one") is not None


def test_read_skips_legacy_entries_without_cache_schema(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    cache_file = tmp_path / "intelligence" / "sweep_2026-05-24.json"
    cache_file.parent.mkdir(parents=True)
    cache_file.write_text(
        json.dumps(
            {
                "AAPL": {
                    "symbol": "AAPL",
                    "generated_at": "2026-05-24T10:00:00Z",
                    "action": "BUY_NOW",
                    "conviction": "high",
                    "catalyst_urgency": "medium",
                    "summary_line": "Legacy.",
                    "narrative": "Legacy.",
                    "news": [
                        {
                            "headline": "Old undated item",
                            "url": "https://example.com/old",
                            "date": None,
                            "sentiment": "neutral",
                        }
                    ],
                }
            }
        )
    )

    assert read_from_cache("AAPL", for_date=date(2026, 5, 24)) is None


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


def test_read_latest_returns_most_recent_across_dates(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    write_to_cache("AAPL", _make_intel().model_copy(update={"summary_line": "Older."}), for_date=date(2026, 5, 23))
    write_to_cache("AAPL", _make_intel().model_copy(update={"summary_line": "Newer."}), for_date=date(2026, 5, 25))
    write_to_cache("AAPL", _make_intel().model_copy(update={"summary_line": "Middle."}), for_date=date(2026, 5, 24))
    result = read_latest_from_cache("AAPL")
    assert result is not None
    assert result.summary_line == "Newer."


def test_read_latest_returns_prior_day_when_today_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    # Only a prior-day file exists; the same-day read misses but latest still resolves it.
    write_to_cache("AAPL", _make_intel(), for_date=date(2026, 5, 23))
    assert read_from_cache("AAPL", for_date=date(2026, 5, 24)) is None
    assert read_latest_from_cache("AAPL") is not None


def test_read_latest_returns_none_when_absent(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    assert read_latest_from_cache("AAPL") is None


def test_multiple_tickers_in_same_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    write_to_cache("AAPL", _make_intel("AAPL"), for_date=d)
    write_to_cache("MSFT", _make_intel("MSFT"), for_date=d)
    cache_file = tmp_path / "intelligence" / "sweep_2026-05-24.json"
    data = json.loads(cache_file.read_text())
    assert "AAPL" in data
    assert "MSFT" in data


def test_concurrent_writes_preserve_distinct_tickers(tmp_path, monkeypatch):
    monkeypatch.setenv("SWING_SCREENER_DATA_DIR", str(tmp_path))
    d = date(2026, 5, 24)
    cache_file = tmp_path / "intelligence" / "sweep_2026-05-24.json"
    cache_file.parent.mkdir(parents=True)
    cache_file.write_text("{}")

    original_dump = SymbolIntelligence.model_dump_json
    barrier = threading.Barrier(2)

    def delayed_dump(self, *args, **kwargs):
        barrier.wait(timeout=3)
        return original_dump(self, *args, **kwargs)

    monkeypatch.setattr(SymbolIntelligence, "model_dump_json", delayed_dump)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(write_to_cache, "AAPL", _make_intel("AAPL"), d),
            executor.submit(write_to_cache, "MSFT", _make_intel("MSFT"), d),
        ]
        for future in futures:
            future.result()

    data = json.loads(cache_file.read_text())
    assert set(data) == {"AAPL", "MSFT"}
