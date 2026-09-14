"""Tests for market data providers."""

from __future__ import annotations

import importlib.util
import os
from types import SimpleNamespace
import pytest
import pandas as pd
from datetime import datetime, timedelta, timezone
import swing_screener.data.providers.yfinance_provider as yfinance_provider_module

from swing_screener.data.providers import (
    YfinanceProvider,
    AlpacaDataProvider,
    get_market_data_provider,
)
from swing_screener.data.providers.polygon_provider import PolygonProvider
from swing_screener.config import BrokerConfig
from swing_screener.data.providers.base import MarketDataCachePolicy

ALPACA_AVAILABLE = importlib.util.find_spec("alpaca") is not None


def _mock_ohlcv_frame(tickers: list[str]) -> pd.DataFrame:
    """Create deterministic OHLCV frame in project-standard MultiIndex format."""
    idx = pd.date_range("2026-01-05", periods=5, freq="D")
    data: dict[tuple[str, str], pd.Series] = {}
    for i, ticker in enumerate(tickers):
        base = 100.0 + i * 10
        data[("Open", ticker)] = pd.Series(
            [base + j for j in range(5)], index=idx, dtype=float
        )
        data[("High", ticker)] = pd.Series(
            [base + 1 + j for j in range(5)], index=idx, dtype=float
        )
        data[("Low", ticker)] = pd.Series(
            [base - 1 + j for j in range(5)], index=idx, dtype=float
        )
        data[("Close", ticker)] = pd.Series(
            [base + 0.5 + j for j in range(5)], index=idx, dtype=float
        )
        data[("Volume", ticker)] = pd.Series(
            [1_000_000 + j for j in range(5)], index=idx, dtype=float
        )
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


class TestYfinanceProvider:
    """Test YfinanceProvider implementation."""

    def test_provider_name(self):
        """Test provider name."""
        provider = YfinanceProvider()
        assert provider.get_provider_name() == "yfinance"

    def test_market_open(self):
        """Test market_open always returns False for yfinance."""
        provider = YfinanceProvider()
        assert provider.is_market_open() is False

    def test_fetch_ohlcv_single_ticker(self, monkeypatch):
        """Test fetching OHLCV data for single ticker."""

        # Mock yf.download to return test data
        def fake_download(*args, **kwargs):
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)
        provider = YfinanceProvider()

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        df = provider.fetch_ohlcv(
            tickers=["AAPL"], start_date=start, end_date=end, interval="1d"
        )

        # Check format
        assert isinstance(df, pd.DataFrame)
        assert isinstance(df.columns, pd.MultiIndex)
        assert df.columns.nlevels == 2

        # Check columns
        fields = df.columns.get_level_values(0).unique()
        assert "Open" in fields
        assert "High" in fields
        assert "Low" in fields
        assert "Close" in fields
        assert "Volume" in fields

        tickers = df.columns.get_level_values(1).unique()
        assert "AAPL" in tickers

        # Check data
        assert not df.empty
        assert df[("Close", "AAPL")].notna().any()

    def test_fetch_ohlcv_multiple_tickers(self, monkeypatch):
        """Test fetching OHLCV data for multiple tickers."""

        # Mock yf.download to return test data
        def fake_download(*args, **kwargs):
            tickers = ["AAPL", "MSFT", "GOOGL"]
            return _mock_ohlcv_frame(tickers)

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)
        provider = YfinanceProvider()

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        tickers = ["AAPL", "MSFT", "GOOGL"]
        df = provider.fetch_ohlcv(
            tickers=tickers, start_date=start, end_date=end, interval="1d"
        )

        # Check all tickers present
        result_tickers = df.columns.get_level_values(1).unique()
        for ticker in tickers:
            assert ticker in result_tickers

    def test_fetch_ohlcv_forwards_requested_interval(self, monkeypatch, tmp_path):
        """The provider interval contract must reach yfinance.download."""
        intervals: list[str | None] = []

        def fake_download(*args, **kwargs):
            intervals.append(kwargs.get("interval"))
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))

        provider.fetch_ohlcv(
            tickers=["AAPL"],
            start_date="2026-01-01",
            end_date="2026-01-31",
            interval="1h",
            use_cache=False,
        )

        assert intervals == ["1h"]

    def test_fetch_latest_price(self, monkeypatch):
        """Test fetching latest price."""

        def fake_ticker(_symbol: str):
            return SimpleNamespace(
                fast_info=SimpleNamespace(last_price=123.45, previous_close=120.0)
            )

        monkeypatch.setattr(
            yfinance_provider_module, "yf", SimpleNamespace(Ticker=fake_ticker)
        )

        provider = YfinanceProvider()
        price = provider.fetch_latest_price("AAPL")

        assert isinstance(price, float)
        assert price == 123.45

    def test_get_ticker_info(self, monkeypatch):
        """Test fetching ticker metadata."""
        metadata = pd.DataFrame.from_dict(
            {
                "AAPL": {
                    "name": "Apple Inc.",
                    "currency": "USD",
                    "exchange": "NASDAQ",
                }
            },
            orient="index",
        )

        def fake_ticker(_symbol: str):
            return SimpleNamespace(
                get_info=lambda: {
                    "shortName": "Apple Inc.",
                    "sector": "Technology",
                    "industry": "Consumer Electronics",
                    "marketCap": 3_000_000_000_000,
                }
            )

        monkeypatch.setattr(
            yfinance_provider_module,
            "fetch_ticker_metadata",
            lambda *args, **kwargs: metadata,
        )
        monkeypatch.setattr(
            yfinance_provider_module, "yf", SimpleNamespace(Ticker=fake_ticker)
        )

        provider = YfinanceProvider()
        info = provider.get_ticker_info("AAPL")

        assert isinstance(info, dict)
        assert "name" in info
        assert "sector" in info
        assert info["name"] == "Apple Inc."

    def test_configures_writable_yfinance_tz_cache(self, monkeypatch, tmp_path):
        """Provider should set yfinance tz cache to a writable local directory."""
        cache_dir = tmp_path / "test_market_data"
        captured: dict[str, str] = {}

        def fake_set_tz_cache_location(path: str):
            captured["path"] = path

        monkeypatch.setattr(
            yfinance_provider_module.yf,
            "set_tz_cache_location",
            fake_set_tz_cache_location,
        )

        YfinanceProvider(cache_dir=str(cache_dir))

        assert "path" in captured
        assert captured["path"].endswith("yfinance_tz_cache")
        assert (cache_dir / "yfinance_tz_cache").exists()

    def test_fetch_ohlcv_retries_missing_tickers(self, monkeypatch, tmp_path):
        """If bulk download drops symbols, provider should retry missing tickers."""
        calls: list[tuple[list[str], object]] = []

        def normalize_tickers(arg) -> list[str]:
            if isinstance(arg, str):
                return [arg]
            return [str(t) for t in arg]

        def fake_download(*args, **kwargs):
            tickers = normalize_tickers(args[0])
            calls.append((tickers, kwargs.get("threads")))
            if set(tickers) == {"AAPL", "MSFT"}:
                return _mock_ohlcv_frame(["AAPL"])  # Missing MSFT in first response
            if tickers == ["MSFT"]:
                return _mock_ohlcv_frame(["MSFT"])
            return _mock_ohlcv_frame(tickers)

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))
        df = provider.fetch_ohlcv(["AAPL", "MSFT"], "2026-01-01", "2026-01-31")

        assert df[("Close", "AAPL")].notna().any()
        assert df[("Close", "MSFT")].notna().any()
        assert any(
            tickers == ["MSFT"] and threads is False for tickers, threads in calls
        )

    def test_fetch_ohlcv_falls_back_to_sequential_on_bulk_error(
        self, monkeypatch, tmp_path
    ):
        """If bulk call raises, provider should recover with one-by-one downloads."""
        calls: list[list[str]] = []

        def normalize_tickers(arg) -> list[str]:
            if isinstance(arg, str):
                return [arg]
            return [str(t) for t in arg]

        def fake_download(*args, **kwargs):
            tickers = normalize_tickers(args[0])
            calls.append(tickers)
            if len(tickers) > 1:
                raise RuntimeError("synthetic bulk failure")
            return _mock_ohlcv_frame(tickers)

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))
        df = provider.fetch_ohlcv(["AAPL", "MSFT"], "2026-01-01", "2026-01-31")

        assert df[("Close", "AAPL")].notna().any()
        assert df[("Close", "MSFT")].notna().any()
        assert ["AAPL"] in calls
        assert ["MSFT"] in calls

    def test_fetch_ohlcv_forces_refresh_on_live_edge(self, monkeypatch, tmp_path):
        """Today/end-date requests should bypass stale cache."""
        cache_dir = tmp_path / "test_cache"
        provider = YfinanceProvider(cache_dir=str(cache_dir))

        # Create a mock cached file
        cache_dir.mkdir(parents=True, exist_ok=True)
        # Mock yf.download to track calls
        download_called = []

        def fake_download(*args, **kwargs):
            download_called.append(True)
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        # First call with today's date - should force refresh
        today = datetime.now().strftime("%Y-%m-%d")
        df1 = provider.fetch_ohlcv(["AAPL"], "2026-01-01", today)

        # Should have called download (not used cache)
        assert len(download_called) >= 1
        assert not df1.empty

    def test_fetch_ohlcv_same_day_reuses_fresh_cache(self, monkeypatch, tmp_path):
        """Same-day requests should reuse a cache file written within the TTL."""
        cache_dir = tmp_path / "test_cache"
        provider = YfinanceProvider(cache_dir=str(cache_dir))

        download_calls = []

        def fake_download(*args, **kwargs):
            download_calls.append(True)
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        today = datetime.now().strftime("%Y-%m-%d")
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", today)
        first_count = len(download_calls)

        df2 = provider.fetch_ohlcv(["AAPL"], "2026-01-01", today)

        assert len(download_calls) == first_count
        assert not df2.empty

    def test_fetch_ohlcv_same_day_refreshes_stale_cache(self, monkeypatch, tmp_path):
        """Same-day requests should re-download once the cached file exceeds the TTL."""
        import os
        import time

        cache_dir = tmp_path / "test_cache"
        provider = YfinanceProvider(cache_dir=str(cache_dir))

        download_calls = []

        def fake_download(*args, **kwargs):
            download_calls.append(True)
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        today = datetime.now().strftime("%Y-%m-%d")
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", today)
        first_count = len(download_calls)

        # Age the cache file beyond the same-day TTL
        stale = time.time() - (provider.same_day_cache_ttl_minutes * 60 + 60)
        for cache_file in cache_dir.rglob("*.parquet"):
            os.utime(cache_file, (stale, stale))

        provider.fetch_ohlcv(["AAPL"], "2026-01-01", today)

        assert len(download_calls) > first_count

    def test_final_close_policy_rejects_cache_written_before_close(
        self, monkeypatch, tmp_path
    ):
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))
        download_calls = []

        def fake_download(*args, **kwargs):
            download_calls.append(True)
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        close = datetime(2026, 1, 31, 21, 10, tzinfo=timezone.utc)
        before_close = close.timestamp() - 60
        for cache_file in (tmp_path / "cache").rglob("*.parquet"):
            os.utime(cache_file, (before_close, before_close))
        first_count = len(download_calls)

        provider.fetch_ohlcv(
            ["AAPL"],
            "2026-01-01",
            "2026-01-31",
            cache_policy=MarketDataCachePolicy(fresh_after_utc=close),
        )

        assert len(download_calls) == first_count + 1

    def test_stale_cache_fallback_is_reported_as_degraded(self, monkeypatch, tmp_path):
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))
        monkeypatch.setattr(
            yfinance_provider_module.yf,
            "download",
            lambda *args, **kwargs: _mock_ohlcv_frame(["AAPL"]),
        )
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        close = datetime(2026, 1, 31, 21, 10, tzinfo=timezone.utc)
        before_close = close.timestamp() - 60
        for cache_file in (tmp_path / "cache").rglob("*.parquet"):
            os.utime(cache_file, (before_close, before_close))
        monkeypatch.setattr(
            yfinance_provider_module.yf,
            "download",
            lambda *args, **kwargs: pd.DataFrame(),
        )

        result = provider.fetch_ohlcv(
            ["AAPL"],
            "2026-01-01",
            "2026-01-31",
            cache_policy=MarketDataCachePolicy(fresh_after_utc=close),
        )

        assert not result.empty
        health = provider.get_source_health()
        assert health.status == "degraded"
        assert "stale_cache_fallback" in health.warnings

    def test_fetch_ohlcv_force_refresh_bypasses_fresh_cache(
        self, monkeypatch, tmp_path
    ):
        """Explicit force_refresh must re-download even when the cache is fresh."""
        cache_dir = tmp_path / "test_cache"
        provider = YfinanceProvider(cache_dir=str(cache_dir))

        download_calls = []

        def fake_download(*args, **kwargs):
            download_calls.append(True)
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        first_count = len(download_calls)

        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31", force_refresh=True)

        assert len(download_calls) > first_count

    def test_fetch_ohlcv_reuses_per_ticker_cache_when_universe_grows(
        self, monkeypatch, tmp_path
    ):
        """Adding a ticker to the universe must not re-download cached tickers."""
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))
        downloaded: list[str] = []

        def fake_download(tickers, *args, **kwargs):
            tks = [tickers] if isinstance(tickers, str) else list(tickers)
            downloaded.extend(tks)
            return _mock_ohlcv_frame(tks)

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        provider.fetch_ohlcv(["AAA", "BBB"], "2026-01-01", "2026-01-31")
        df = provider.fetch_ohlcv(["AAA", "BBB", "CCC"], "2026-01-01", "2026-01-31")

        assert downloaded.count("AAA") == 1
        assert downloaded.count("BBB") == 1
        assert "CCC" in downloaded
        for ticker in ["AAA", "BBB", "CCC"]:
            assert ticker in df["Close"].columns

    def test_fetch_ohlcv_cache_is_partitioned_by_interval(self, monkeypatch, tmp_path):
        """Daily cached coverage must not satisfy a later intraday request."""
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))
        intervals: list[str | None] = []

        def fake_download(tickers, *args, **kwargs):
            intervals.append(kwargs.get("interval"))
            tks = [tickers] if isinstance(tickers, str) else list(tickers)
            return _mock_ohlcv_frame(tks)

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        provider.fetch_ohlcv(["AAA"], "2026-01-01", "2026-01-31", interval="1d")
        provider.fetch_ohlcv(["AAA"], "2026-01-01", "2026-01-31", interval="1h")

        assert intervals == ["1d", "1h"]

    def test_fetch_ohlcv_trims_download_to_requested_inclusive_end(
        self, monkeypatch, tmp_path
    ):
        """Provider output must not include bars after the requested end date."""
        requested_ends: list[str | None] = []
        idx = pd.to_datetime(["2026-01-01", "2026-01-02", "2026-01-03"])
        data = {
            ("Open", "AAA"): pd.Series([100.0, 101.0, 102.0], index=idx),
            ("High", "AAA"): pd.Series([101.0, 102.0, 103.0], index=idx),
            ("Low", "AAA"): pd.Series([99.0, 100.0, 101.0], index=idx),
            ("Close", "AAA"): pd.Series([100.5, 101.5, 102.5], index=idx),
            ("Volume", "AAA"): pd.Series([1_000_000, 1_000_001, 1_000_002], index=idx),
        }
        raw = pd.DataFrame(data, index=idx)
        raw.columns = pd.MultiIndex.from_tuples(raw.columns)

        def fake_download(*args, **kwargs):
            requested_ends.append(kwargs.get("end"))
            return raw

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))

        df = provider.fetch_ohlcv(["AAA"], "2026-01-01", "2026-01-02", use_cache=False)

        assert requested_ends == ["2026-01-03"]
        assert pd.Timestamp("2026-01-02") in df.index
        assert df.index.max() == pd.Timestamp("2026-01-02")

    def test_fetch_ohlcv_serves_subwindow_from_cache(self, monkeypatch, tmp_path):
        """A narrower window inside cached coverage is served without downloads."""
        provider = YfinanceProvider(cache_dir=str(tmp_path / "cache"))
        download_calls = []

        def fake_download(*args, **kwargs):
            download_calls.append(True)
            return _mock_ohlcv_frame(["AAA"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        provider.fetch_ohlcv(["AAA"], "2026-01-01", "2026-01-31")
        first_count = len(download_calls)

        df = provider.fetch_ohlcv(["AAA"], "2026-01-06", "2026-01-08")

        assert len(download_calls) == first_count
        assert not df.empty
        assert df.index.min() >= pd.Timestamp("2026-01-06")
        assert df.index.max() <= pd.Timestamp("2026-01-08")

    def test_fetch_ohlcv_keeps_cache_for_historical_end_date(
        self, monkeypatch, tmp_path
    ):
        """Historical windows should keep normal cache behavior."""
        cache_dir = tmp_path / "test_cache"
        provider = YfinanceProvider(cache_dir=str(cache_dir))

        # Mock yf.download
        download_call_count = []

        def fake_download(*args, **kwargs):
            download_call_count.append(True)
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        # Call with historical dates - should use cache on second call
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        first_call_count = len(download_call_count)

        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        second_call_count = len(download_call_count)

        # Second call should use cache (same download count)
        assert second_call_count == first_call_count

    def test_uses_configured_cache_dir(self, monkeypatch, tmp_path):
        """Provider should use configured cache_dir."""
        cache_dir = tmp_path / "test_market_data"

        # Mock yf.download
        def fake_download(*args, **kwargs):
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        provider = YfinanceProvider(cache_dir=str(cache_dir))

        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")

        # Check that cache directory was created
        assert cache_dir.exists()
        # Check that cache files exist in the directory
        cache_files = list(cache_dir.rglob("*.parquet"))
        assert len(cache_files) > 0

    def test_fetch_ohlcv_recovers_from_corrupted_cache(self, monkeypatch, tmp_path):
        """Corrupted parquet cache should be deleted and refreshed from provider."""
        cache_dir = tmp_path / "test_corrupted_cache"
        provider = YfinanceProvider(cache_dir=str(cache_dir))

        calls = {"count": 0}

        def fake_download(*args, **kwargs):
            calls["count"] += 1
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)

        # Use historical window so normal cache reads apply.
        start = "2026-01-01"
        end = "2026-01-31"
        provider.fetch_ohlcv(["AAPL"], start, end)
        cache_files = list(cache_dir.rglob("*.parquet"))
        assert len(cache_files) == 1
        cache_files[0].write_bytes(b"not-a-parquet-file")

        df = provider.fetch_ohlcv(["AAPL"], start, end)

        assert not df.empty
        assert calls["count"] == 2
        # Should have replaced corrupt bytes with a readable parquet file.
        reread = pd.read_parquet(cache_files[0])
        assert not reread.empty


def _polygon_bars(close: float) -> list[dict]:
    """Deterministic single-bar Polygon payload with the given close."""
    ts_ms = int(pd.Timestamp("2026-01-30", tz="UTC").timestamp() * 1000)
    return [
        {
            "t": ts_ms,
            "o": close - 1.0,
            "h": close + 1.0,
            "l": close - 2.0,
            "c": close,
            "v": 1_000_000,
            "vw": close,
            "n": 10,
        }
    ]


class TestPolygonProvider:
    """Test PolygonProvider cache freshness policy enforcement."""

    def _make_provider(self, tmp_path) -> PolygonProvider:
        return PolygonProvider(
            api_key="test-key",
            cache_dir=str(tmp_path / "polygon"),
            rate_limit_sleep=0.0,
            cache_ttl_days=7.0,
        )

    def test_final_close_policy_rejects_cache_written_before_close(
        self, monkeypatch, tmp_path
    ):
        provider = self._make_provider(tmp_path)
        closes = [100.0, 200.0]
        calls: list[str] = []

        def fake_bars(ticker: str, start_date: str, end_date: str) -> list[dict]:
            calls.append(ticker)
            return _polygon_bars(closes[min(len(calls) - 1, 1)])

        monkeypatch.setattr(provider, "_fetch_bars_from_api", fake_bars)
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        assert len(calls) == 1

        close = datetime(2026, 1, 31, 21, 10, tzinfo=timezone.utc)
        before_close = close.timestamp() - 60
        for cache_file in (tmp_path / "polygon").rglob("*.parquet"):
            os.utime(cache_file, (before_close, before_close))

        result = provider.fetch_ohlcv(
            ["AAPL"],
            "2026-01-01",
            "2026-01-31",
            cache_policy=MarketDataCachePolicy(fresh_after_utc=close),
        )

        assert len(calls) == 2
        assert float(result[("Close", "AAPL")].iloc[-1]) == 200.0

    def test_final_close_policy_reuses_cache_written_after_close(
        self, monkeypatch, tmp_path
    ):
        provider = self._make_provider(tmp_path)
        calls: list[str] = []

        def fake_bars(ticker: str, start_date: str, end_date: str) -> list[dict]:
            calls.append(ticker)
            return _polygon_bars(100.0)

        monkeypatch.setattr(provider, "_fetch_bars_from_api", fake_bars)
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        assert len(calls) == 1

        close = datetime(2026, 1, 31, 21, 10, tzinfo=timezone.utc)
        after_close = close.timestamp() + 60
        for cache_file in (tmp_path / "polygon").rglob("*.parquet"):
            os.utime(cache_file, (after_close, after_close))

        result = provider.fetch_ohlcv(
            ["AAPL"],
            "2026-01-01",
            "2026-01-31",
            cache_policy=MarketDataCachePolicy(fresh_after_utc=close),
        )

        assert len(calls) == 1
        assert float(result[("Close", "AAPL")].iloc[-1]) == 100.0

        # Boundary is inclusive: mtime exactly at fresh_after_utc reuses cache.
        for cache_file in (tmp_path / "polygon").rglob("*.parquet"):
            os.utime(cache_file, (close.timestamp(), close.timestamp()))
        result = provider.fetch_ohlcv(
            ["AAPL"],
            "2026-01-01",
            "2026-01-31",
            cache_policy=MarketDataCachePolicy(fresh_after_utc=close),
        )
        assert len(calls) == 1
        assert float(result[("Close", "AAPL")].iloc[-1]) == 100.0

    def test_historical_cache_reuse_and_refresh_flags_preserved(
        self, monkeypatch, tmp_path
    ):
        provider = self._make_provider(tmp_path)
        calls: list[str] = []

        def fake_bars(ticker: str, start_date: str, end_date: str) -> list[dict]:
            calls.append(ticker)
            return _polygon_bars(100.0)

        monkeypatch.setattr(provider, "_fetch_bars_from_api", fake_bars)

        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        assert len(calls) == 1

        # Default historical request reuses the cache.
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        assert len(calls) == 1

        # force_refresh bypasses a fresh cache.
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31", force_refresh=True)
        assert len(calls) == 2

        # use_cache=False bypasses a fresh cache.
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31", use_cache=False)
        assert len(calls) == 3

    def test_force_refresh_bypasses_fresh_cache_with_policy(
        self, monkeypatch, tmp_path
    ):
        provider = self._make_provider(tmp_path)
        calls: list[str] = []

        def fake_bars(ticker: str, start_date: str, end_date: str) -> list[dict]:
            calls.append(ticker)
            return _polygon_bars(100.0)

        monkeypatch.setattr(provider, "_fetch_bars_from_api", fake_bars)
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        assert len(calls) == 1

        # Fresh cache (mtime after fresh_after_utc) would normally be reused,
        # but force_refresh bypasses it regardless of the policy.
        close = datetime(2026, 1, 31, 21, 10, tzinfo=timezone.utc)
        after_close = close.timestamp() + 60
        for cache_file in (tmp_path / "polygon").rglob("*.parquet"):
            os.utime(cache_file, (after_close, after_close))

        provider.fetch_ohlcv(
            ["AAPL"],
            "2026-01-01",
            "2026-01-31",
            force_refresh=True,
            cache_policy=MarketDataCachePolicy(fresh_after_utc=close),
        )
        assert len(calls) == 2

    def test_use_cache_false_bypasses_fresh_cache_with_policy(
        self, monkeypatch, tmp_path
    ):
        provider = self._make_provider(tmp_path)
        calls: list[str] = []

        def fake_bars(ticker: str, start_date: str, end_date: str) -> list[dict]:
            calls.append(ticker)
            return _polygon_bars(100.0)

        monkeypatch.setattr(provider, "_fetch_bars_from_api", fake_bars)
        provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        assert len(calls) == 1

        # Fresh cache (mtime after fresh_after_utc) would normally be reused,
        # but use_cache=False bypasses it regardless of the policy.
        close = datetime(2026, 1, 31, 21, 10, tzinfo=timezone.utc)
        after_close = close.timestamp() + 60
        for cache_file in (tmp_path / "polygon").rglob("*.parquet"):
            os.utime(cache_file, (after_close, after_close))

        provider.fetch_ohlcv(
            ["AAPL"],
            "2026-01-01",
            "2026-01-31",
            use_cache=False,
            cache_policy=MarketDataCachePolicy(fresh_after_utc=close),
        )
        assert len(calls) == 2


class TestMarketDataCachePolicyContract:
    """Cache-capable providers must honor MarketDataCachePolicy."""

    def test_stale_cache_forces_refetch(self, monkeypatch, tmp_path):
        close = datetime(2026, 1, 31, 21, 10, tzinfo=timezone.utc)
        policy = MarketDataCachePolicy(fresh_after_utc=close)
        before_close = close.timestamp() - 60

        yf_provider = YfinanceProvider(cache_dir=str(tmp_path / "contract-yf"))
        monkeypatch.setattr(
            yfinance_provider_module.yf,
            "download",
            lambda *args, **kwargs: _mock_ohlcv_frame(["AAPL"]),
        )
        yf_provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        for cache_file in (tmp_path / "contract-yf").rglob("*.parquet"):
            os.utime(cache_file, (before_close, before_close))
        yf_calls: list[bool] = []

        def counting_download(*args, **kwargs):
            yf_calls.append(True)
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", counting_download)
        yf_provider.fetch_ohlcv(
            ["AAPL"], "2026-01-01", "2026-01-31", cache_policy=policy
        )
        assert yf_calls, "YfinanceProvider must refetch stale final-close cache"

        poly_provider = PolygonProvider(
            api_key="test-key",
            cache_dir=str(tmp_path / "contract-polygon"),
            rate_limit_sleep=0.0,
            cache_ttl_days=7.0,
        )
        poly_calls: list[str] = []

        def fake_bars(ticker: str, start_date: str, end_date: str) -> list[dict]:
            poly_calls.append(ticker)
            return _polygon_bars(100.0)

        monkeypatch.setattr(poly_provider, "_fetch_bars_from_api", fake_bars)
        poly_provider.fetch_ohlcv(["AAPL"], "2026-01-01", "2026-01-31")
        assert len(poly_calls) == 1
        for cache_file in (tmp_path / "contract-polygon").rglob("*.parquet"):
            os.utime(cache_file, (before_close, before_close))
        poly_provider.fetch_ohlcv(
            ["AAPL"], "2026-01-01", "2026-01-31", cache_policy=policy
        )
        assert len(poly_calls) == 2, "PolygonProvider must refetch stale cache"


class TestBrokerConfig:
    """Test BrokerConfig."""

    def test_default_config(self):
        """Test default configuration."""
        config = BrokerConfig()
        assert config.provider == "yfinance"
        assert config.alpaca_api_key is None
        assert config.alpaca_secret_key is None
        assert config.alpaca_paper is True

    def test_validate_yfinance(self):
        """Test validation for yfinance provider."""
        config = BrokerConfig(provider="yfinance")
        config.validate()  # Should not raise

    def test_validate_alpaca_missing_keys(self):
        """Test validation fails for Alpaca without keys."""
        config = BrokerConfig(provider="alpaca")
        with pytest.raises(ValueError, match="requires api_key"):
            config.validate()

    def test_validate_alpaca_with_keys(self):
        """Test validation succeeds for Alpaca with keys."""
        config = BrokerConfig(
            provider="alpaca",
            alpaca_api_key="test_key",
            alpaca_secret_key="test_secret",
        )
        config.validate()  # Should not raise

    def test_validate_invalid_provider(self):
        """Test validation fails for invalid provider."""
        config = BrokerConfig(provider="invalid")
        with pytest.raises(ValueError, match="Invalid provider"):
            config.validate()


class TestProviderFactory:
    """Test provider factory."""

    def test_get_market_data_provider(self):
        """Test getting default provider."""
        provider = get_market_data_provider()
        assert isinstance(provider, YfinanceProvider)
        assert provider.get_provider_name() == "yfinance"

    def test_get_yfinance_provider(self):
        """Test creating yfinance provider."""
        config = BrokerConfig(provider="yfinance")
        provider = get_market_data_provider(config)
        assert isinstance(provider, YfinanceProvider)

    def test_get_alpaca_provider(self):
        """Test creating alpaca provider."""
        config = BrokerConfig(
            provider="alpaca",
            alpaca_api_key="test_key",
            alpaca_secret_key="test_secret",
        )
        if not ALPACA_AVAILABLE:
            with pytest.raises(ModuleNotFoundError, match="alpaca-py"):
                get_market_data_provider(config)
            return
        provider = get_market_data_provider(config)
        assert isinstance(provider, AlpacaDataProvider)
        assert provider.get_provider_name() in ("alpaca", "alpaca-paper")

    def test_invalid_provider_raises(self):
        """Test invalid provider raises error."""
        config = BrokerConfig(provider="invalid")
        with pytest.raises(ValueError):
            get_market_data_provider(config)


class TestAlpacaProvider:
    """Test AlpacaDataProvider (requires API keys)."""

    @pytest.fixture(autouse=True)
    def skip_if_no_alpaca_package(self):
        """Skip class if alpaca-py is not installed."""
        if not ALPACA_AVAILABLE:
            pytest.skip("alpaca-py not installed")

    @pytest.fixture
    def skip_if_no_alpaca_keys(self):
        """Skip test if Alpaca keys not available."""
        import os

        if not os.getenv("ALPACA_API_KEY") or not os.getenv("ALPACA_SECRET_KEY"):
            pytest.skip("Alpaca API keys not available")

    def test_provider_name(self):
        """Test provider name."""
        provider = AlpacaDataProvider(
            api_key="test_key", secret_key="test_secret", paper=True
        )
        assert provider.get_provider_name() == "alpaca-paper"

    def test_parse_timeframe(self):
        """Test timeframe parsing."""
        provider = AlpacaDataProvider(api_key="test_key", secret_key="test_secret")

        from alpaca.data.timeframe import TimeFrame

        # Test that parsing works and returns TimeFrame objects
        result_1d = provider._parse_timeframe("1d")
        result_1h = provider._parse_timeframe("1h")
        result_1m = provider._parse_timeframe("1m")

        assert isinstance(result_1d, TimeFrame)
        assert isinstance(result_1h, TimeFrame)
        assert isinstance(result_1m, TimeFrame)

        # Test that invalid interval raises ValueError
        with pytest.raises(ValueError, match="Unsupported interval"):
            provider._parse_timeframe("invalid")

    @pytest.mark.integration
    def test_fetch_ohlcv_integration(self, skip_if_no_alpaca_keys):
        """Integration test: fetch real data from Alpaca."""
        import os

        provider = AlpacaDataProvider(
            api_key=os.getenv("ALPACA_API_KEY"),
            secret_key=os.getenv("ALPACA_SECRET_KEY"),
            paper=True,
        )

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")

        try:
            df = provider.fetch_ohlcv(
                tickers=["AAPL"], start_date=start, end_date=end, interval="1d"
            )
        except ConnectionError as exc:
            if "subscription does not permit querying recent SIP data" in str(exc):
                pytest.skip("Alpaca subscription does not include recent SIP data")
            raise

        # Check format matches yfinance
        assert isinstance(df, pd.DataFrame)
        assert isinstance(df.columns, pd.MultiIndex)
        assert ("Close", "AAPL") in df.columns
        assert not df.empty


class TestProviderCompatibility:
    """Test that all providers return compatible DataFrame format."""

    def test_yfinance_format(self, monkeypatch):
        """Test yfinance provider returns correct format."""

        # Mock yf.download
        def fake_download(*args, **kwargs):
            return _mock_ohlcv_frame(["AAPL"])

        monkeypatch.setattr(yfinance_provider_module.yf, "download", fake_download)
        yf_provider = YfinanceProvider()

        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")

        yf_df = yf_provider.fetch_ohlcv(["AAPL"], start, end)

        # Check structure
        assert isinstance(yf_df.columns, pd.MultiIndex)
        assert yf_df.columns.nlevels == 2

        fields = set(yf_df.columns.get_level_values(0))
        assert fields == {"Open", "High", "Low", "Close", "Volume"}
