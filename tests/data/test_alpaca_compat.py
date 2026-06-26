"""Alpaca provider compatibility: tz-naive index, index→ETF proxy, FX via yfinance.

These cover the three bugs that surfaced when switching the data provider to
Alpaca (which yfinance previously masked):
  - Alpaca returns a tz-aware UTC index -> breaks date comparisons downstream.
  - Universe benchmarks are index symbols (^NDX) Alpaca cannot fetch.
  - EURUSD FX uses the Yahoo symbol convention Alpaca's stocks API rejects.
"""
from __future__ import annotations

import pandas as pd
import pytest

try:
    from swing_screener.data.providers.alpaca_provider import AlpacaDataProvider
    import alpaca  # noqa: F401
    ALPACA_AVAILABLE = True
except Exception:  # pragma: no cover - environment without alpaca-py
    ALPACA_AVAILABLE = False


pytestmark = pytest.mark.skipif(not ALPACA_AVAILABLE, reason="alpaca-py not installed")


def _fake_alpaca_df(symbols: list[str], dates: pd.DatetimeIndex) -> pd.DataFrame:
    """Mimic alpaca-py `bars.df`: MultiIndex (symbol, timestamp), tz-aware UTC."""
    idx = pd.MultiIndex.from_product([symbols, dates], names=["symbol", "timestamp"])
    n = len(idx)
    return pd.DataFrame(
        {
            "open": [100.0] * n,
            "high": [101.0] * n,
            "low": [99.0] * n,
            "close": [100.5] * n,
            "volume": [1000] * n,
            "trade_count": [10] * n,
            "vwap": [100.2] * n,
        },
        index=idx,
    )


class _FakeBars:
    def __init__(self, df: pd.DataFrame) -> None:
        self.df = df


class _FakeClient:
    def __init__(self, df: pd.DataFrame) -> None:
        self._df = df
        self.requested: object = None

    def get_stock_bars(self, request):  # noqa: ANN001
        self.requested = request.symbol_or_symbols
        return _FakeBars(self._df)


def _provider_with(df: pd.DataFrame) -> tuple[AlpacaDataProvider, _FakeClient]:
    provider = AlpacaDataProvider(api_key="k", secret_key="s", paper=True, use_cache=False)
    client = _FakeClient(df)
    provider.client = client
    return provider, client


# Alpaca daily bars are stamped at 00:00 ET == 04:00 UTC (EDT).
_DATES = pd.to_datetime(["2026-06-15 04:00:00", "2026-06-16 04:00:00"]).tz_localize("UTC")


def test_index_returns_tz_naive_date_index():
    provider, _ = _provider_with(_fake_alpaca_df(["AAPL"], _DATES))
    out = provider.fetch_ohlcv(["AAPL"], "2026-06-15", "2026-06-16")
    assert isinstance(out.index, pd.DatetimeIndex)
    assert out.index.tz is None
    # 04:00 UTC -> 00:00 ET -> naive midnight (the trading date)
    assert list(out.index) == [pd.Timestamp("2026-06-15"), pd.Timestamp("2026-06-16")]


def test_index_benchmark_mapped_to_etf_proxy():
    provider, client = _provider_with(_fake_alpaca_df(["AAPL", "QQQ"], _DATES))
    out = provider.fetch_ohlcv(["AAPL", "^NDX"], "2026-06-15", "2026-06-16")
    # ^NDX requested from Alpaca as its ETF proxy QQQ, never as the raw index
    assert "QQQ" in client.requested
    assert "^NDX" not in client.requested
    # benchmark column still exposed under the original index symbol
    assert ("Close", "^NDX") in out.columns
    assert out[("Close", "^NDX")].notna().all()


def test_index_without_proxy_is_dropped_not_fatal():
    # ^AEX (Amsterdam) has no Alpaca ETF proxy -> dropped, equities still fetched
    provider, client = _provider_with(_fake_alpaca_df(["AAPL"], _DATES))
    out = provider.fetch_ohlcv(["AAPL", "^AEX"], "2026-06-15", "2026-06-16")
    assert "^AEX" not in client.requested
    assert ("Close", "AAPL") in out.columns
    assert ("Close", "^AEX") not in out.columns


def test_all_unsupported_indices_raises():
    provider, _ = _provider_with(_fake_alpaca_df(["AAPL"], _DATES))
    with pytest.raises(ValueError, match="Alpaca"):
        provider.fetch_ohlcv(["^AEX"], "2026-06-15", "2026-06-16")


def test_eurusd_rate_uses_yfinance_not_active_provider(monkeypatch):
    """FX must come from yfinance regardless of the configured equity provider."""
    from api.services import portfolio_service as ps

    ps._eurusd_cache.clear()

    captured = {}

    class _StubYf:
        def fetch_ohlcv(self, tickers, start_date, end_date, interval="1d"):
            captured["tickers"] = tickers
            idx = pd.to_datetime(["2026-06-15", "2026-06-16"])
            return pd.DataFrame(
                {("Close", "EURUSD=X"): [1.10, 1.15]}, index=idx
            )

    monkeypatch.setattr(
        "swing_screener.data.providers.yfinance_provider.YfinanceProvider",
        lambda *a, **k: _StubYf(),
    )

    # Active provider would raise on FX (Alpaca behaviour) — must not be used.
    class _BoomProvider:
        def fetch_ohlcv(self, *a, **k):
            raise AssertionError("FX must not use the active equity provider")

    svc = ps.PortfolioService.__new__(ps.PortfolioService)
    svc._provider = _BoomProvider()

    rate = svc._eurusd_rate()
    assert captured["tickers"] == ["EURUSD=X"]
    assert rate == pytest.approx(1.15)
    ps._eurusd_cache.clear()
