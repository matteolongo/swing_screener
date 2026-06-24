import pandas as pd
import pytest

from swing_screener.data.providers.yfinance_provider import YfinanceProvider
from swing_screener.data.providers.stooq_provider import StooqDataProvider
from swing_screener.data.providers.alpaca_provider import AlpacaDataProvider
from swing_screener.data.source_health import SourceDescriptor, ProbeResult


def test_yfinance_describe_static():
    d = YfinanceProvider.describe()
    assert isinstance(d, SourceDescriptor)
    assert d.id == "yfinance"
    assert d.domain == "market_data"
    assert d.role == "primary"
    assert d.configured is True
    assert d.probeable is True


def test_stooq_describe_static():
    d = StooqDataProvider.describe()
    assert d.id == "stooq"
    assert d.role == "fallback"
    assert d.canary_market == "eu"


def test_alpaca_describe_not_configured_without_keys(monkeypatch):
    monkeypatch.delenv("ALPACA_API_KEY", raising=False)
    monkeypatch.delenv("ALPACA_SECRET_KEY", raising=False)
    d = AlpacaDataProvider.describe()
    assert d.id == "alpaca"
    assert d.configured is False
    assert d.requires == "ALPACA_API_KEY"


def test_alpaca_probe_not_configured_returns_status(monkeypatch):
    monkeypatch.delenv("ALPACA_API_KEY", raising=False)
    monkeypatch.delenv("ALPACA_SECRET_KEY", raising=False)
    r = AlpacaDataProvider.probe("AAPL")
    assert isinstance(r, ProbeResult)
    assert r.status == "not_configured"


def test_yfinance_probe_ok_when_data(monkeypatch):
    df = pd.DataFrame(
        {("Close", "AAPL"): [100.0, 101.0]},
        index=pd.to_datetime(["2026-06-22", "2026-06-23"]),
    )
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    monkeypatch.setattr(
        "swing_screener.data.providers.yfinance_provider.YfinanceProvider.fetch_ohlcv",
        lambda self, tickers, start_date, end_date, interval="1d": df,
    )
    r = YfinanceProvider.probe("AAPL")
    assert r.status == "ok"
    assert r.latency_ms is not None
    assert r.sample["last_close"] == 101.0


def test_yfinance_probe_down_on_empty(monkeypatch):
    monkeypatch.setattr(
        "swing_screener.data.providers.yfinance_provider.YfinanceProvider.fetch_ohlcv",
        lambda self, tickers, start_date, end_date, interval="1d": pd.DataFrame(),
    )
    r = YfinanceProvider.probe("AAPL")
    assert r.status == "down"
