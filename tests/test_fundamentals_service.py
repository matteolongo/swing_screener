from __future__ import annotations

from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import (
    FundamentalMetricSeries,
    FundamentalSeriesPoint,
    ProviderFundamentalsRecord,
)
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
            historical_series={
                "revenue": FundamentalMetricSeries(
                    label="Revenue",
                    unit="currency",
                    points=[
                        FundamentalSeriesPoint(period_end="2025-05-01", value=80_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=84_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=88_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=94_000_000_000.0),
                    ],
                ),
                "operating_margin": FundamentalMetricSeries(
                    label="Operating margin",
                    unit="percent",
                    points=[
                        FundamentalSeriesPoint(period_end="2025-05-01", value=0.27),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=0.28),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=0.29),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=0.31),
                    ],
                ),
            },
            metric_sources={
                "revenue_growth_yoy": self.name,
                "revenue_history": "yfinance.quarterly_income_stmt",
            },
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


class _FakeFallbackHistoryProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date="2026-03-18",
            provider=self.name,
            instrument_type="equity",
            company_name="History Co.",
            sector="Technology",
            currency="USD",
            market_cap=250_000_000_000.0,
            gross_margin=0.42,
            debt_to_equity=65.0,
            current_ratio=1.2,
            return_on_equity=0.18,
            trailing_pe=24.0,
            price_to_sales=4.5,
            historical_series={
                "revenue": FundamentalMetricSeries(
                    label="Revenue",
                    unit="currency",
                    points=[
                        FundamentalSeriesPoint(period_end="2025-02-01", value=100.0),
                        FundamentalSeriesPoint(period_end="2025-05-01", value=97.0),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=94.0),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=91.0),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=86.0),
                    ],
                ),
                "operating_margin": FundamentalMetricSeries(
                    label="Operating margin",
                    unit="percent",
                    points=[
                        FundamentalSeriesPoint(period_end="2025-05-01", value=0.22),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=0.19),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=0.16),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=0.12),
                    ],
                ),
                "free_cash_flow_margin": FundamentalMetricSeries(
                    label="FCF margin",
                    unit="percent",
                    points=[
                        FundamentalSeriesPoint(period_end="2025-05-01", value=0.12),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=0.09),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=0.05),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=0.01),
                    ],
                ),
                "free_cash_flow": FundamentalMetricSeries(
                    label="Free cash flow",
                    unit="currency",
                    points=[
                        FundamentalSeriesPoint(period_end="2025-05-01", value=12.0),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=9.0),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=4.0),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=1.0),
                    ],
                ),
            },
            metric_sources={
                "revenue_history": "yfinance.quarterly_income_stmt",
                "free_cash_flow_history": "yfinance.quarterly_cashflow",
            },
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
    assert snapshot.historical_series["revenue"].direction == "improving"
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


def test_fundamentals_service_uses_history_as_metric_fallback_and_flags_deterioration(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeFallbackHistoryProvider(),
    )

    snapshot = service.get_snapshot(
        "HIST",
        cfg=FundamentalsConfig(providers=("yfinance",), cache_ttl_hours=24, stale_after_days=120, compare_limit=5),
        force_refresh=True,
    )

    assert snapshot.symbol == "HIST"
    assert snapshot.operating_margin == 0.12
    assert snapshot.free_cash_flow_margin == 0.01
    assert snapshot.most_recent_quarter == "2026-02-01"
    assert snapshot.historical_series["operating_margin"].direction == "deteriorating"
    assert snapshot.historical_series["free_cash_flow_margin"].direction == "deteriorating"
    assert "Operating margin is deteriorating." in snapshot.red_flags
    assert "Cash-flow conversion is deteriorating." in snapshot.red_flags
    assert "Snapshot was supplemented with statement history." in snapshot.highlights
