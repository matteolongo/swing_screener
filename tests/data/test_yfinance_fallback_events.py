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
