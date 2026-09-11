import pandas as pd
import pytest

from swing_screener.data.market_data import MarketDataConfig, fetch_ohlcv
from swing_screener.utils.dataframe_helpers import normalize_ohlcv


def _fake_download_multiindex(*args, **kwargs):
    idx = pd.bdate_range("2023-01-02", periods=5)
    data = {}
    for field, base in [
        ("Open", 100.0),
        ("High", 101.0),
        ("Low", 99.0),
        ("Close", 100.5),
        ("Volume", 1_000_000.0),
    ]:
        data[(field, "AAPL")] = pd.Series(base, index=idx, dtype=float)
        data[(field, "MSFT")] = pd.Series(base + 10, index=idx, dtype=float)
        data[(field, "SPY")] = pd.Series(base + 20, index=idx, dtype=float)
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def test_fetch_ohlcv_returns_multiindex(monkeypatch):
    monkeypatch.setattr(
        "swing_screener.data.providers.yfinance_provider.yf.download",
        _fake_download_multiindex,
    )
    df = fetch_ohlcv(
        ["AAPL", "MSFT", "SPY"], MarketDataConfig(start="2023-01-01"), use_cache=False
    )
    assert isinstance(df, pd.DataFrame)
    assert isinstance(df.columns, pd.MultiIndex)
    assert ("Close", "AAPL") in df.columns


def test_fetch_ohlcv_fallbacks_to_cache_on_download_error(tmp_path, monkeypatch):
    cache_dir = tmp_path / "cache"
    cfg = MarketDataConfig(start="2023-01-01", cache_dir=str(cache_dir))

    # Warm the per-ticker cache with a successful fetch first.
    monkeypatch.setattr(
        "swing_screener.data.providers.yfinance_provider.yf.download",
        _fake_download_multiindex,
    )
    warm = fetch_ohlcv(["AAPL", "MSFT", "SPY"], cfg)

    def _raise(*args, **kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr(
        "swing_screener.data.providers.yfinance_provider.yf.download", _raise
    )

    df = fetch_ohlcv(["AAPL", "MSFT", "SPY"], cfg, use_cache=False)
    assert ("Close", "AAPL") in df.columns
    assert len(df) == len(warm)


def test_normalize_ohlcv_sorts_dates_and_keeps_last_duplicate_row():
    columns = pd.MultiIndex.from_tuples([("Close", "AAPL"), ("Volume", "AAPL")])
    frame = pd.DataFrame(
        [[12.0, 120.0], [10.0, float("nan")], [11.0, 110.0]],
        index=["2026-01-03", "2026-01-01", "2026-01-03"],
        columns=columns,
    )

    normalized = normalize_ohlcv(frame)

    assert isinstance(normalized.index, pd.DatetimeIndex)
    assert normalized.index.tolist() == [
        pd.Timestamp("2026-01-01"),
        pd.Timestamp("2026-01-03"),
    ]
    assert normalized.loc[pd.Timestamp("2026-01-03"), ("Close", "AAPL")] == 11.0
    assert pd.isna(normalized.loc[pd.Timestamp("2026-01-01"), ("Volume", "AAPL")])


def test_normalize_ohlcv_rejects_duplicate_columns():
    columns = pd.MultiIndex.from_tuples([("Close", "AAPL"), ("Close", "AAPL")])
    frame = pd.DataFrame([[10.0, 11.0]], index=["2026-01-01"], columns=columns)

    with pytest.raises(ValueError, match="duplicate"):
        normalize_ohlcv(frame)


def test_normalize_ohlcv_rejects_missing_close_and_invalid_dates():
    missing_close = pd.DataFrame(
        [[10.0]],
        index=["2026-01-01"],
        columns=pd.MultiIndex.from_tuples([("Open", "AAPL")]),
    )
    invalid_date = pd.DataFrame(
        [[10.0]],
        index=["not-a-date"],
        columns=pd.MultiIndex.from_tuples([("Close", "AAPL")]),
    )

    with pytest.raises(ValueError, match="Close"):
        normalize_ohlcv(missing_close)
    with pytest.raises(ValueError, match="date"):
        normalize_ohlcv(invalid_date)
