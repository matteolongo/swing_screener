import pandas as pd

from swing_screener.data.providers.yfinance_provider import YfinanceProvider
from swing_screener.data.source_health import recent_events, reset_fallback_events


def test_stooq_fallback_records_event(monkeypatch, tmp_path):
    reset_fallback_events()
    provider = YfinanceProvider(cache_dir=str(tmp_path))

    # Force the stooq fallback path: stooq raises -> event recorded.
    def boom(*args, **kwargs):
        raise RuntimeError("stooq down")

    monkeypatch.setattr(provider._stooq_provider, "fetch_ohlcv", boom)
    provider._fetch_stooq_fallback(["ASML.AS"], "2026-06-01", "2026-06-10", interval="1d")

    events = recent_events()
    assert any(e.from_provider == "yfinance" and e.fell_back_to == "stooq" for e in events)


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
    monkeypatch.setattr(provider, "_fetch_stooq_fallback", lambda *a, **kw: pd.DataFrame())

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
