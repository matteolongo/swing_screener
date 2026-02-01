import pandas as pd
from swing_screener.data.market_data import fetch_ohlcv, MarketDataConfig


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
        "swing_screener.data.market_data.yf.download", _fake_download_multiindex
    )
    df = fetch_ohlcv(
        ["AAPL", "MSFT", "SPY"], MarketDataConfig(start="2023-01-01"), use_cache=False
    )
    assert isinstance(df, pd.DataFrame)
    assert isinstance(df.columns, pd.MultiIndex)
    assert ("Close", "AAPL") in df.columns


def test_fetch_ohlcv_fallbacks_to_cache_on_download_error(tmp_path, monkeypatch):
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cfg = MarketDataConfig(start="2023-01-01", cache_dir=str(cache_dir))

    expected = _fake_download_multiindex()
    cached = expected.copy()
    cached.to_parquet(
        cache_dir / "AAPL-MSFT-SPY__2023-01-01__NONE__adj=1.parquet"
    )

    def _raise(*args, **kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr("swing_screener.data.market_data.yf.download", _raise)

    df = fetch_ohlcv(["AAPL", "MSFT", "SPY"], cfg, use_cache=False)
    assert ("Close", "AAPL") in df.columns
    assert len(df) == len(cached)
