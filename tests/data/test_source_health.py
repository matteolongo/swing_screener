from swing_screener.data.source_health import (
    DataSourceHealth,
    DataSourceProvenance,
    merge_source_health,
    SourceDescriptor,
    ProbeResult,
    FallbackEvent,
)
from swing_screener.data.providers.alpaca_provider import AlpacaDataProvider
from swing_screener.data.providers.base import MarketDataProvider
from swing_screener.data.providers.yfinance_provider import YfinanceProvider


class DummyProvider(MarketDataProvider):
    def fetch_ohlcv(self, tickers, start_date, end_date, interval="1d"):
        raise NotImplementedError

    def fetch_latest_price(self, ticker):
        raise NotImplementedError

    def get_ticker_info(self, ticker):
        raise NotImplementedError

    def is_market_open(self):
        return False

    def get_provider_name(self):
        return "dummy"


def test_source_health_defaults_are_conservative():
    health = DataSourceHealth(provider="yfinance", domain="market_data")

    assert health.status == "unknown"
    assert health.quality_score == 0.5
    assert health.delay_policy == "unknown"
    assert health.warnings == []


def test_provenance_serializes_provider_domain_and_asof():
    provenance = DataSourceProvenance(
        provider="sec_edgar",
        domain="fundamentals",
        asof_date="2026-05-28",
        fetched_at="2026-05-28T12:00:00+00:00",
        fields=["revenue_growth_yoy", "operating_margin"],
    )

    payload = provenance.to_dict()

    assert payload["provider"] == "sec_edgar"
    assert payload["domain"] == "fundamentals"
    assert payload["fields"] == ["revenue_growth_yoy", "operating_margin"]


def test_merge_source_health_penalizes_warnings_and_failures():
    merged = merge_source_health(
        [
            DataSourceHealth(
                provider="sec_edgar",
                domain="fundamentals",
                status="ok",
                quality_score=0.9,
            ),
            DataSourceHealth(
                provider="yfinance",
                domain="metadata",
                status="degraded",
                quality_score=0.6,
                warnings=["unofficial"],
            ),
        ]
    )

    assert merged.provider == "combined"
    assert merged.domain == "aggregate"
    assert 0.6 <= merged.quality_score < 0.9
    assert merged.status == "degraded"


def test_market_data_provider_default_health_is_unknown_and_neutral():
    health = DummyProvider().get_source_health()

    assert health.to_dict() == {
        "provider": "dummy",
        "domain": "market_data",
        "status": "unknown",
        "quality_score": 0.5,
        "delay_policy": "unknown",
        "warnings": [],
    }


def test_market_data_provider_quality_defaults_are_explicit(tmp_path):
    yfinance = YfinanceProvider(cache_dir=str(tmp_path / "yf"))
    alpaca_paper = AlpacaDataProvider(
        api_key="paper-key",
        secret_key="paper-secret",
        paper=True,
        cache_dir=str(tmp_path / "alpaca"),
    )

    yfinance_health = yfinance.get_source_health().to_dict()
    alpaca_health = alpaca_paper.get_source_health().to_dict()

    assert yfinance_health["provider"] == "yfinance"
    assert yfinance_health["status"] == "ok"
    assert yfinance_health["quality_score"] == 0.65
    assert yfinance_health["delay_policy"] == "delayed_or_eod"
    assert yfinance_health["warnings"] == ["unofficial_provider"]

    assert alpaca_health["provider"] == "alpaca-paper"
    assert alpaca_health["quality_score"] == 0.75
    assert alpaca_health["delay_policy"] == "provider_plan_dependent"
    assert alpaca_health["warnings"] == ["paper_or_basic_plan_may_be_limited"]


def test_source_descriptor_to_dict_roundtrip():
    d = SourceDescriptor(
        id="yfinance",
        display_name="Yahoo Finance",
        domain="market_data",
        role="primary",
        requires=None,
        configured=True,
        probeable=True,
        canary_market="us",
        note=None,
    )
    payload = d.to_dict()
    assert payload["id"] == "yfinance"
    assert payload["domain"] == "market_data"
    assert payload["role"] == "primary"
    assert payload["configured"] is True
    assert payload["canary_market"] == "us"


def test_probe_result_to_dict():
    r = ProbeResult(
        id="stooq",
        status="ok",
        latency_ms=42.5,
        detail="1 bar",
        sample={"last_close": 123.4, "last_date": "2026-06-23"},
        error=None,
    )
    payload = r.to_dict()
    assert payload["status"] == "ok"
    assert payload["latency_ms"] == 42.5
    assert payload["sample"]["last_close"] == 123.4


def test_fallback_event_to_dict():
    e = FallbackEvent(
        ts="2026-06-24T10:00:00+00:00",
        domain="market_data",
        from_provider="yfinance",
        reason="bulk download empty",
        fell_back_to="stooq",
        tickers=["AAPL", "MSFT"],
        stale_asof=None,
    )
    payload = e.to_dict()
    assert payload["from_provider"] == "yfinance"
    assert payload["fell_back_to"] == "stooq"
    assert payload["tickers"] == ["AAPL", "MSFT"]
