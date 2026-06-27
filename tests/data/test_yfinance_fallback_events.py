import inspect
from datetime import date, timedelta

import pandas as pd
import pytest
from unittest.mock import patch

from swing_screener.data.providers.yfinance_provider import YfinanceProvider
from swing_screener.data.source_health import recent_events, reset_fallback_events


def test_yfinance_provider_has_no_stooq_params():
    sig = inspect.signature(YfinanceProvider.__init__)
    assert "stooq_fallback_enabled" not in sig.parameters
    assert "stooq_timeout_sec" not in sig.parameters
    assert "stooq_provider" not in sig.parameters


def test_bulk_failure_falls_through_to_stale_cache(tmp_path, monkeypatch):
    """When yfinance bulk download returns empty, provider uses cached data."""
    provider = YfinanceProvider(cache_dir=str(tmp_path))

    start_date = date.today() - timedelta(days=10)
    end_date = date.today() - timedelta(days=5)
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()
    # fetch_ohlcv adds 1 day to end_date; end_for_coverage = end_str + 1 day
    end_for_coverage = (end_date + timedelta(days=1)).isoformat()

    # Pre-populate cache via the provider's own writer so the path/index matches.
    # end_for_coverage must match so the index entry covers the request window.
    aapl_df = pd.DataFrame(
        {("Close", "AAPL"): [152.0], ("Open", "AAPL"): [150.0],
         ("High", "AAPL"): [155.0], ("Low", "AAPL"): [148.0],
         ("Volume", "AAPL"): [1000000.0]},
        index=pd.to_datetime([start_str]),
    )
    aapl_df.columns = pd.MultiIndex.from_tuples(aapl_df.columns)
    provider._store_per_ticker_cache(aapl_df, ["AAPL"], start_str, end_for_coverage)

    # Force download to fail so the stale-cache branch is exercised.
    monkeypatch.setattr(provider, "_download_batch", lambda *a, **kw: pd.DataFrame())
    monkeypatch.setattr(provider, "_download_sequential", lambda *a, **kw: pd.DataFrame())

    result = provider.fetch_ohlcv(
        ["AAPL"],
        start_date=start_str,
        end_date=end_str,
        allow_cache_fallback_on_error=True,
    )

    assert not result.empty, "Expected cache to be served when download fails"


def test_no_stale_cache_event_when_only_fresh_cache_served(monkeypatch, tmp_path):
    """
    Regression: the first stale-cache site must NOT fire when the stale loop adds nothing.

    Setup:
    - AAPL is fully cached (fresh): lands in cached_frames during the first loop.
    - MSFT is a miss with no stale fallback at all.
    - All download paths return empty DataFrames, so the all-empty branch executes.
    - The stale loop iterates stale_fallback (empty for MSFT, absent for AAPL) -> appends nothing.
    - Pre-fix: `if cached_frames:` fires because AAPL is already there -> false positive.
    - Post-fix: `if len(cached_frames) > _pre_stale_len_1:` is False -> no event.
    """
    reset_fallback_events()
    start_date = "2026-06-01"
    end_date = "2026-06-10"
    end_for_coverage = "2026-06-11"  # exclusive end used by _store_per_ticker_cache

    provider = YfinanceProvider(cache_dir=str(tmp_path))

    # Build a real fresh-cache entry for AAPL.
    aapl_df = pd.DataFrame(
        {("Close", "AAPL"): [150.0, 151.0], ("Open", "AAPL"): [149.0, 150.0]},
        index=pd.to_datetime(["2026-06-02", "2026-06-03"]),
    )
    aapl_df.columns = pd.MultiIndex.from_tuples(aapl_df.columns)
    provider._store_per_ticker_cache(aapl_df, ["AAPL"], start_date, end_for_coverage)

    # Disable all live-download paths.
    monkeypatch.setattr(provider, "_download_batch", lambda *a, **kw: pd.DataFrame())
    monkeypatch.setattr(provider, "_download_sequential", lambda *a, **kw: pd.DataFrame())

    # Call with AAPL (fresh cache hit) + MSFT (miss, no stale fallback).
    # Should succeed because AAPL frame is in cached_frames.
    result = provider._fetch_ohlcv_with_config(
        ["AAPL", "MSFT"],
        start_date,
        end_for_coverage,
        use_cache=True,
        force_refresh=False,
        allow_cache_fallback_on_error=True,
    )

    assert not result.empty, "Expected AAPL data in result"

    stale_events = [
        e for e in recent_events()
        if e.fell_back_to == "stale_cache"
    ]
    assert stale_events == [], (
        f"Expected no stale-cache events but got: {stale_events}"
    )
