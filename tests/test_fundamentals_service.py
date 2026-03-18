from __future__ import annotations

from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import ProviderFundamentalsRecord
from swing_screener.fundamentals.service import FundamentalsAnalysisService
from swing_screener.fundamentals.storage import FundamentalsStorage


class _FakeEquityProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date="2026-03-18",
            provider=self.name,
            instrument_type="equity",
            company_name="Apple Inc.",
            sector="Technology",
            currency="USD",
            most_recent_quarter="2026-02-01",
            market_cap=3_000_000_000_000.0,
            revenue_growth_yoy=0.18,
            earnings_growth_yoy=0.24,
            gross_margin=0.46,
            operating_margin=0.31,
            free_cash_flow=90_000_000_000.0,
            free_cash_flow_margin=0.24,
            debt_to_equity=45.0,
            current_ratio=1.4,
            return_on_equity=0.28,
            trailing_pe=28.0,
            price_to_sales=7.0,
            metric_sources={"revenue_growth_yoy": self.name},
        )


class _FakeEtfProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date="2026-03-18",
            provider=self.name,
            instrument_type="etf",
            company_name="SPY ETF",
            currency="USD",
        )


def test_fundamentals_service_builds_supported_equity_snapshot(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeEquityProvider(),
    )

    snapshot = service.get_snapshot(
        "AAPL",
        cfg=FundamentalsConfig(providers=("yfinance",), cache_ttl_hours=24, stale_after_days=120, compare_limit=5),
        force_refresh=True,
    )

    assert snapshot.symbol == "AAPL"
    assert snapshot.supported is True
    assert snapshot.coverage_status == "supported"
    assert snapshot.freshness_status == "current"
    assert snapshot.pillars["growth"].status == "strong"
    assert snapshot.highlights


def test_fundamentals_service_marks_etf_as_unsupported(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeEtfProvider(),
    )

    snapshot = service.get_snapshot(
        "SPY",
        cfg=FundamentalsConfig(providers=("yfinance",), cache_ttl_hours=24, stale_after_days=120, compare_limit=5),
        force_refresh=True,
    )

    assert snapshot.symbol == "SPY"
    assert snapshot.supported is False
    assert snapshot.coverage_status == "unsupported"
    assert "equity" in snapshot.highlights[0].lower()
