"""Tests for PolygonProvider."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

import swing_screener.data.providers.polygon_provider as polygon_module
from swing_screener.data.providers.polygon_provider import PolygonProvider
from swing_screener.data.source_health import SourceDescriptor, ProbeResult
from swing_screener.config import BrokerConfig
from swing_screener.data.providers import get_market_data_provider


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_bars(ticker: str, n: int = 5) -> list[dict]:
    """Minimal polygon-style bar dicts (timestamps in ms UTC)."""
    base_ts = 1_735_689_600_000  # 2025-01-01 00:00:00 UTC in ms
    return [
        {
            "t": base_ts + i * 86_400_000,
            "o": 100.0 + i,
            "h": 102.0 + i,
            "l": 99.0 + i,
            "c": 101.0 + i,
            "v": 1_000_000 + i,
        }
        for i in range(n)
    ]


# ---------------------------------------------------------------------------
# Provider basics
# ---------------------------------------------------------------------------

class TestPolygonProviderBasics:
    def test_provider_name(self):
        p = PolygonProvider(api_key="test-key")
        assert p.get_provider_name() == "polygon"

    def test_is_market_open_always_false(self):
        p = PolygonProvider(api_key="test-key")
        assert p.is_market_open() is False


# ---------------------------------------------------------------------------
# DiagnosableSource contract
# ---------------------------------------------------------------------------

class TestPolygonProviderDiagnostics:
    def test_describe_not_configured_without_key(self, monkeypatch):
        monkeypatch.delenv("POLYGON_IO_API_KEY", raising=False)
        d = PolygonProvider.describe()
        assert isinstance(d, SourceDescriptor)
        assert d.id == "polygon"
        assert d.domain == "market_data"
        assert d.configured is False
        assert d.requires == "POLYGON_IO_API_KEY"

    def test_describe_configured_when_key_present(self, monkeypatch):
        monkeypatch.setenv("POLYGON_IO_API_KEY", "test-key")
        d = PolygonProvider.describe()
        assert d.configured is True

    def test_probe_not_configured_when_no_key(self, monkeypatch):
        monkeypatch.delenv("POLYGON_IO_API_KEY", raising=False)
        r = PolygonProvider.probe("AAPL")
        assert isinstance(r, ProbeResult)
        assert r.status == "not_configured"

    def test_probe_ok_when_data_returned(self, monkeypatch):
        monkeypatch.setenv("POLYGON_IO_API_KEY", "test-key")
        monkeypatch.setattr(
            polygon_module.PolygonProvider,
            "_fetch_bars_from_api",
            lambda self, ticker, start, end: _fake_bars(ticker),
        )
        r = PolygonProvider.probe("AAPL")
        assert r.status == "ok"
        assert r.latency_ms is not None
        assert r.sample["last_close"] == pytest.approx(105.0)  # last of 5 bars: 101+4

    def test_probe_down_on_exception(self, monkeypatch):
        monkeypatch.setenv("POLYGON_IO_API_KEY", "test-key")

        def fail(self, ticker, start, end):
            raise RuntimeError("network error")

        monkeypatch.setattr(polygon_module.PolygonProvider, "_fetch_bars_from_api", fail)
        r = PolygonProvider.probe("AAPL")
        assert r.status == "down"


# ---------------------------------------------------------------------------
# fetch_ohlcv
# ---------------------------------------------------------------------------

class TestPolygonProviderFetchOHLCV:
    def test_returns_multiindex_dataframe(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            polygon_module.PolygonProvider,
            "_fetch_bars_from_api",
            lambda self, ticker, start, end: _fake_bars(ticker),
        )
        p = PolygonProvider(api_key="test-key", cache_dir=str(tmp_path))
        df = p.fetch_ohlcv(["AAPL"], "2025-01-01", "2025-01-10")

        assert isinstance(df, pd.DataFrame)
        assert isinstance(df.columns, pd.MultiIndex)
        assert df.columns.nlevels == 2
        fields = set(df.columns.get_level_values(0))
        assert fields == {"Open", "High", "Low", "Close", "Volume"}
        assert "AAPL" in df.columns.get_level_values(1)
        assert not df.empty

    def test_multiple_tickers_all_present(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            polygon_module.PolygonProvider,
            "_fetch_bars_from_api",
            lambda self, ticker, start, end: _fake_bars(ticker),
        )
        p = PolygonProvider(api_key="test-key", cache_dir=str(tmp_path))
        df = p.fetch_ohlcv(["AAPL", "MSFT", "GOOGL"], "2025-01-01", "2025-01-10")

        tickers = df.columns.get_level_values(1).unique()
        for t in ["AAPL", "MSFT", "GOOGL"]:
            assert t in tickers

    def test_values_mapped_correctly(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            polygon_module.PolygonProvider,
            "_fetch_bars_from_api",
            lambda self, ticker, start, end: _fake_bars(ticker, n=1),
        )
        p = PolygonProvider(api_key="test-key", cache_dir=str(tmp_path))
        df = p.fetch_ohlcv(["AAPL"], "2025-01-01", "2025-01-02")

        assert df[("Open", "AAPL")].iloc[0] == pytest.approx(100.0)
        assert df[("High", "AAPL")].iloc[0] == pytest.approx(102.0)
        assert df[("Low", "AAPL")].iloc[0] == pytest.approx(99.0)
        assert df[("Close", "AAPL")].iloc[0] == pytest.approx(101.0)
        assert df[("Volume", "AAPL")].iloc[0] == pytest.approx(1_000_000)

    def test_historical_fetch_uses_cache_on_second_call(self, monkeypatch, tmp_path):
        call_counts: dict[str, int] = {}

        def counting_fetch(self, ticker, start, end):
            call_counts[ticker] = call_counts.get(ticker, 0) + 1
            return _fake_bars(ticker)

        monkeypatch.setattr(polygon_module.PolygonProvider, "_fetch_bars_from_api", counting_fetch)
        p = PolygonProvider(api_key="test-key", cache_dir=str(tmp_path))

        p.fetch_ohlcv(["AAPL"], "2025-01-01", "2025-01-10")
        p.fetch_ohlcv(["AAPL"], "2025-01-01", "2025-01-10")

        assert call_counts.get("AAPL", 0) == 1

    def test_new_ticker_in_universe_does_not_refetch_cached(self, monkeypatch, tmp_path):
        call_counts: dict[str, int] = {}

        def counting_fetch(self, ticker, start, end):
            call_counts[ticker] = call_counts.get(ticker, 0) + 1
            return _fake_bars(ticker)

        monkeypatch.setattr(polygon_module.PolygonProvider, "_fetch_bars_from_api", counting_fetch)
        p = PolygonProvider(api_key="test-key", cache_dir=str(tmp_path))

        p.fetch_ohlcv(["AAPL", "MSFT"], "2025-01-01", "2025-01-10")
        p.fetch_ohlcv(["AAPL", "MSFT", "GOOGL"], "2025-01-01", "2025-01-10")

        assert call_counts["AAPL"] == 1
        assert call_counts["MSFT"] == 1
        assert call_counts["GOOGL"] == 1

    def test_empty_api_response_yields_nan_column(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            polygon_module.PolygonProvider,
            "_fetch_bars_from_api",
            lambda self, ticker, start, end: [],
        )
        p = PolygonProvider(api_key="test-key", cache_dir=str(tmp_path))
        df = p.fetch_ohlcv(["AAPL"], "2025-01-01", "2025-01-10")

        assert ("Close", "AAPL") in df.columns


# ---------------------------------------------------------------------------
# BrokerConfig integration
# ---------------------------------------------------------------------------

class TestBrokerConfigPolygon:
    def test_validate_polygon_accepts_key(self):
        cfg = BrokerConfig(provider="polygon", polygon_api_key="test-key")
        cfg.validate()  # must not raise

    def test_validate_polygon_rejects_missing_key(self):
        cfg = BrokerConfig(provider="polygon")
        with pytest.raises(ValueError, match="POLYGON_IO_API_KEY"):
            cfg.validate()

    def test_from_env_reads_polygon_provider(self, monkeypatch):
        monkeypatch.setenv("SWING_SCREENER_PROVIDER", "polygon")
        monkeypatch.setenv("POLYGON_IO_API_KEY", "env-key")
        cfg = BrokerConfig.from_env()
        assert cfg.provider == "polygon"
        assert cfg.polygon_api_key == "env-key"


# ---------------------------------------------------------------------------
# Factory integration
# ---------------------------------------------------------------------------

class TestFactoryPolygon:
    def test_factory_creates_polygon_provider(self):
        cfg = BrokerConfig(provider="polygon", polygon_api_key="test-key")
        p = get_market_data_provider(cfg)
        assert isinstance(p, PolygonProvider)
        assert p.get_provider_name() == "polygon"


# ---------------------------------------------------------------------------
# Polygon OHLCV cache TTL tests
# ---------------------------------------------------------------------------

import time as _time
import os as _os


def _make_provider(tmp_path: Path, cache_ttl_days: float = 7.0) -> PolygonProvider:
    return PolygonProvider(
        api_key="TEST_KEY",
        cache_dir=str(tmp_path),
        rate_limit_sleep=0,
        cache_ttl_days=cache_ttl_days,
    )


def _write_parquet_cache(path: Path, age_seconds: float) -> None:
    """Write an empty parquet at `path` with mtime set to `age_seconds` ago."""
    df = pd.DataFrame()
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)
    old_mtime = _time.time() - age_seconds
    _os.utime(path, (old_mtime, old_mtime))


def test_polygon_recent_range_cache_expires(tmp_path):
    """A recent-range cache file older than TTL is re-fetched."""
    from datetime import date, timedelta
    today = date.today().isoformat()
    start = (date.today() - timedelta(days=30)).isoformat()

    provider = _make_provider(tmp_path, cache_ttl_days=7)
    cache_path = provider._cache_path("AAPL", start, today)

    # Write a stale cache file (10 days old, TTL is 7)
    _write_parquet_cache(cache_path, age_seconds=10 * 86400)

    fetched = []

    def mock_fetch(ticker, s, e):
        fetched.append(ticker)
        return []

    with patch.object(provider, "_fetch_bars_from_api", side_effect=mock_fetch):
        provider._fetch_ticker("AAPL", start, today)

    assert fetched == ["AAPL"], "Expected re-fetch when recent-range cache is expired"


def test_polygon_historical_range_never_expires(tmp_path):
    """A historical-range cache file is used regardless of age."""
    from datetime import date, timedelta
    start = "2023-01-01"
    end = "2023-06-30"  # strictly in the past

    provider = _make_provider(tmp_path, cache_ttl_days=7)
    cache_path = provider._cache_path("AAPL", start, end)

    # Write a cache file with real content (365 days old)
    frames = [{"o": 150.0, "h": 155.0, "l": 149.0, "c": 152.0, "v": 1000000, "t": 1672531200000}]
    df_real = provider._bars_to_series(frames, "AAPL")
    df_real.to_parquet(cache_path)
    old_mtime = _time.time() - (365 * 86400)
    _os.utime(cache_path, (old_mtime, old_mtime))

    fetched = []
    with patch.object(provider, "_fetch_bars_from_api", side_effect=lambda t, s, e: fetched.append(t) or []):
        provider._fetch_ticker("AAPL", start, end)

    assert fetched == [], "Historical range should use cache regardless of age"


def test_polygon_recent_range_fresh_cache_used(tmp_path):
    """A recent-range cache file within TTL is returned without re-fetching."""
    from datetime import date, timedelta
    today = date.today().isoformat()
    start = (date.today() - timedelta(days=30)).isoformat()

    provider = _make_provider(tmp_path, cache_ttl_days=7)
    cache_path = provider._cache_path("AAPL", start, today)

    # Write a fresh cache (1 day old, TTL is 7)
    frames = [{"o": 150.0, "h": 155.0, "l": 149.0, "c": 152.0, "v": 1000000, "t": 1672531200000}]
    df_real = provider._bars_to_series(frames, "AAPL")
    df_real.to_parquet(cache_path)
    old_mtime = _time.time() - (1 * 86400)
    _os.utime(cache_path, (old_mtime, old_mtime))

    fetched = []
    with patch.object(provider, "_fetch_bars_from_api", side_effect=lambda t, s, e: fetched.append(t) or []):
        provider._fetch_ticker("AAPL", start, today)

    assert fetched == [], "Fresh cache should be used without re-fetching"
