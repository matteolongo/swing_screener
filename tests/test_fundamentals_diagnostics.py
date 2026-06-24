from swing_screener.fundamentals.providers.sec_edgar import SecEdgarFundamentalsProvider
from swing_screener.fundamentals.providers.yfinance import YfinanceFundamentalsProvider
from swing_screener.fundamentals.providers.degiro import DegiroFundamentalsProvider
from swing_screener.fundamentals.finnhub_client import FinnhubEnrichmentClient
from swing_screener.data.source_health import SourceDescriptor, ProbeResult


def test_sec_edgar_describe():
    d = SecEdgarFundamentalsProvider.describe()
    assert d.id == "sec_edgar"
    assert d.domain == "fundamentals"
    assert d.role == "primary"


def test_yfinance_fundamentals_describe():
    d = YfinanceFundamentalsProvider.describe()
    assert d.id == "yfinance_fundamentals"
    assert d.role == "fallback"


def test_degiro_describe_configured_reflects_availability():
    d = DegiroFundamentalsProvider.describe()
    assert d.id == "degiro"
    assert isinstance(d.configured, bool)
    assert d.probeable == d.configured


def test_finnhub_describe_not_configured_without_key(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    d = FinnhubEnrichmentClient.describe()
    assert d.id == "finnhub"
    assert d.role == "enrichment"
    assert d.configured is False
    assert d.requires == "FINNHUB_API_KEY"


def test_finnhub_probe_not_configured_without_key(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    r = FinnhubEnrichmentClient.probe("AAPL")
    assert r.status == "not_configured"
