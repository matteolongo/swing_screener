from __future__ import annotations

from dataclasses import replace

import pytest

from swing_screener.fundamentals.config import FundamentalsConfig
from swing_screener.fundamentals.models import (
    FundamentalMetricContext,
    FundamentalMetricSeries,
    FundamentalSeriesPoint,
    ProviderFundamentalsRecord,
)
from swing_screener.fundamentals.service import FundamentalsAnalysisService
from swing_screener.fundamentals.storage import FundamentalsStorage
from swing_screener.utils.file_lock import locked_write_json_cli


class _FakeQuarterlyProvider:
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
            market_cap=3_000_000_000_000.0,
            gross_margin=0.46,
            debt_to_equity=45.0,
            current_ratio=1.4,
            return_on_equity=0.28,
            trailing_pe=28.0,
            price_to_sales=7.0,
            earnings_growth_yoy=0.24,
            historical_series={
                "revenue": FundamentalMetricSeries(
                    label="Revenue",
                    unit="currency",
                    frequency="quarterly",
                    source="yfinance.quarterly_income_stmt",
                    derived_from=["yfinance.quarterly_income_stmt"],
                    points=[
                        FundamentalSeriesPoint(period_end="2025-02-01", value=80_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-05-01", value=82_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=84_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=88_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=94_000_000_000.0),
                    ],
                ),
                "operating_margin": FundamentalMetricSeries(
                    label="Operating margin",
                    unit="percent",
                    frequency="quarterly",
                    source="yfinance.quarterly_income_stmt",
                    derived_from=[
                        "yfinance.quarterly_income_stmt",
                        "yfinance.quarterly_income_stmt",
                    ],
                    points=[
                        FundamentalSeriesPoint(period_end="2025-02-01", value=0.26),
                        FundamentalSeriesPoint(period_end="2025-05-01", value=0.27),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=0.28),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=0.29),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=0.31),
                    ],
                ),
                "free_cash_flow": FundamentalMetricSeries(
                    label="Free cash flow",
                    unit="currency",
                    frequency="quarterly",
                    source="yfinance.quarterly_cashflow",
                    derived_from=["yfinance.quarterly_cashflow"],
                    points=[
                        FundamentalSeriesPoint(period_end="2025-02-01", value=18_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-05-01", value=19_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=20_000_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=21_500_000_000.0),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=23_000_000_000.0),
                    ],
                ),
                "free_cash_flow_margin": FundamentalMetricSeries(
                    label="FCF margin",
                    unit="percent",
                    frequency="quarterly",
                    source="yfinance.quarterly_cashflow + yfinance.quarterly_income_stmt",
                    derived_from=[
                        "yfinance.quarterly_cashflow",
                        "yfinance.quarterly_income_stmt",
                    ],
                    points=[
                        FundamentalSeriesPoint(period_end="2025-02-01", value=0.225),
                        FundamentalSeriesPoint(period_end="2025-05-01", value=0.232),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=0.238),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=0.244),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=0.245),
                    ],
                ),
            },
            metric_sources={
                "earnings_growth_yoy": "yfinance.info.earningsGrowth",
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


class _FakeAnnualHistoryProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date="2026-03-18",
            provider=self.name,
            instrument_type="equity",
            company_name="Annual Co.",
            sector="Industrials",
            currency="USD",
            gross_margin=0.39,
            debt_to_equity=72.0,
            current_ratio=1.35,
            return_on_equity=0.17,
            trailing_pe=18.0,
            price_to_sales=2.8,
            historical_series={
                "revenue": FundamentalMetricSeries(
                    label="Revenue",
                    unit="currency",
                    frequency="annual",
                    source="yfinance.financials",
                    derived_from=["yfinance.financials"],
                    points=[
                        FundamentalSeriesPoint(period_end="2022-12-31", value=4_100_000_000.0),
                        FundamentalSeriesPoint(period_end="2023-12-31", value=4_350_000_000.0),
                        FundamentalSeriesPoint(period_end="2024-12-31", value=4_700_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-12-31", value=5_050_000_000.0),
                    ],
                ),
                "operating_margin": FundamentalMetricSeries(
                    label="Operating margin",
                    unit="percent",
                    frequency="annual",
                    source="yfinance.financials",
                    derived_from=["yfinance.financials", "yfinance.financials"],
                    points=[
                        FundamentalSeriesPoint(period_end="2022-12-31", value=0.15),
                        FundamentalSeriesPoint(period_end="2023-12-31", value=0.17),
                        FundamentalSeriesPoint(period_end="2024-12-31", value=0.19),
                        FundamentalSeriesPoint(period_end="2025-12-31", value=0.21),
                    ],
                ),
            },
        )


class _FakeMixedCadenceProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date="2026-03-18",
            provider=self.name,
            instrument_type="equity",
            company_name="Mixed Co.",
            sector="Energy",
            currency="USD",
            revenue_growth_yoy=0.19,
            earnings_growth_yoy=0.21,
            gross_margin=0.34,
            debt_to_equity=90.0,
            current_ratio=1.15,
            return_on_equity=0.16,
            trailing_pe=12.0,
            price_to_sales=1.9,
            metric_sources={
                "revenue_growth_yoy": "yfinance.info.revenueGrowth",
                "earnings_growth_yoy": "yfinance.info.earningsGrowth",
            },
            historical_series={
                "revenue": FundamentalMetricSeries(
                    label="Revenue",
                    unit="currency",
                    frequency="annual",
                    source="yfinance.financials",
                    derived_from=["yfinance.financials"],
                    points=[
                        FundamentalSeriesPoint(period_end="2022-12-31", value=4_913_000_000.0),
                        FundamentalSeriesPoint(period_end="2023-12-31", value=4_962_000_000.0),
                        FundamentalSeriesPoint(period_end="2024-12-31", value=4_784_000_000.0),
                        FundamentalSeriesPoint(period_end="2025-12-31", value=5_903_000_000.0),
                    ],
                ),
            },
        )


class _FakeOutlierGrowthProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date="2026-03-18",
            provider=self.name,
            instrument_type="equity",
            company_name="Outlier Co.",
            sector="Technology",
            currency="USD",
            revenue_growth_yoy=0.11,
            earnings_growth_yoy=17.196,
            gross_margin=0.44,
            operating_margin=0.28,
            free_cash_flow=4_200_000_000.0,
            free_cash_flow_margin=0.19,
            debt_to_equity=54.0,
            current_ratio=1.5,
            return_on_equity=0.22,
            trailing_pe=24.0,
            price_to_sales=4.8,
            metric_sources={
                "revenue_growth_yoy": "yfinance.info.revenueGrowth",
                "earnings_growth_yoy": "yfinance.info.earningsGrowth",
            },
        )


class _FakeMismatchHistoryProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date="2026-03-18",
            provider=self.name,
            instrument_type="equity",
            company_name="Mismatch Co.",
            sector="Services",
            currency="USD",
            gross_margin=0.41,
            debt_to_equity=65.0,
            current_ratio=1.1,
            return_on_equity=0.15,
            trailing_pe=19.0,
            price_to_sales=2.7,
            historical_series={
                "revenue": FundamentalMetricSeries(
                    label="Revenue",
                    unit="currency",
                    frequency="quarterly",
                    source="yfinance.quarterly_income_stmt",
                    derived_from=["yfinance.quarterly_income_stmt"],
                    points=[
                        FundamentalSeriesPoint(period_end="2025-05-01", value=100.0),
                        FundamentalSeriesPoint(period_end="2025-08-01", value=97.0),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=94.0),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=91.0),
                    ],
                ),
                "free_cash_flow_margin": FundamentalMetricSeries(
                    label="FCF margin",
                    unit="percent",
                    frequency="unknown",
                    source="yfinance.quarterly_cashflow + yfinance.financials",
                    derived_from=[
                        "yfinance.quarterly_cashflow",
                        "yfinance.financials",
                    ],
                    points=[
                        FundamentalSeriesPoint(period_end="2025-08-01", value=0.12),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=0.11),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=0.09),
                    ],
                ),
                "free_cash_flow": FundamentalMetricSeries(
                    label="Free cash flow",
                    unit="currency",
                    frequency="quarterly",
                    source="yfinance.quarterly_cashflow",
                    derived_from=["yfinance.quarterly_cashflow"],
                    points=[
                        FundamentalSeriesPoint(period_end="2025-08-01", value=12.0),
                        FundamentalSeriesPoint(period_end="2025-11-01", value=9.0),
                        FundamentalSeriesPoint(period_end="2026-02-01", value=6.0),
                    ],
                ),
            },
        )


class _FakeBookValueProvider:
    name = "yfinance"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        return ProviderFundamentalsRecord(
            symbol=symbol,
            asof_date="2026-03-18",
            provider=self.name,
            instrument_type="equity",
            company_name="Book Co.",
            sector="Financials",
            currency="USD",
            market_cap=12_000_000_000.0,
            earnings_growth_yoy=0.08,
            gross_margin=0.52,
            debt_to_equity=88.0,
            current_ratio=1.05,
            return_on_equity=0.14,
            shares_outstanding=500_000_000.0,
            total_equity=10_000_000_000.0,
            metric_context={
                "market_cap": FundamentalMetricContext(
                    source="yfinance.info.marketCap",
                    cadence="snapshot",
                    derived=False,
                    derived_from=[],
                    period_end="2026-03-18",
                ),
                "total_equity": FundamentalMetricContext(
                    source="yfinance.balance_sheet",
                    cadence="annual",
                    derived=False,
                    derived_from=[],
                    period_end="2025-12-31",
                ),
                "shares_outstanding": FundamentalMetricContext(
                    source="yfinance.info.sharesOutstanding",
                    cadence="snapshot",
                    derived=False,
                    derived_from=[],
                    period_end="2026-03-18",
                ),
            },
            metric_sources={
                "market_cap": "yfinance.info.marketCap",
                "total_equity": "yfinance.balance_sheet",
                "shares_outstanding": "yfinance.info.sharesOutstanding",
            },
        )


def _cfg() -> FundamentalsConfig:
    return FundamentalsConfig(providers=("yfinance",), cache_ttl_hours=24, stale_after_days=120, compare_limit=5)


class _FakeSecProvider:
    name = "sec_edgar"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        base = _FakeQuarterlyProvider().fetch_record(symbol)
        return replace(
            base,
            provider=self.name,
            metric_sources={"earnings_growth_yoy": "sec_edgar.us-gaap.NetIncomeLoss"},
        )


class _BrokenSecProvider:
    name = "sec_edgar"

    def fetch_record(self, symbol: str) -> ProviderFundamentalsRecord:
        raise ValueError(f"SEC companyfacts unavailable for {symbol}")


def test_fundamentals_service_builds_supported_quarterly_snapshot_with_high_trust(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeQuarterlyProvider(),
    )

    snapshot = service.get_snapshot("AAPL", cfg=_cfg(), force_refresh=True)

    assert snapshot.symbol == "AAPL"
    assert snapshot.supported is True
    assert snapshot.coverage_status == "supported"
    assert snapshot.freshness_status == "current"
    assert snapshot.historical_series["revenue"].direction == "improving"
    assert snapshot.historical_series["revenue"].frequency == "quarterly"
    assert snapshot.metric_context["revenue_growth_yoy"].cadence == "quarterly"
    assert snapshot.data_quality_status == "high"
    assert snapshot.data_quality_flags == []
    assert "Quarterly revenue trend is improving." in snapshot.highlights


def test_fundamentals_service_marks_etf_as_unsupported(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeEtfProvider(),
    )

    snapshot = service.get_snapshot("SPY", cfg=_cfg(), force_refresh=True)

    assert snapshot.symbol == "SPY"
    assert snapshot.supported is False
    assert snapshot.coverage_status == "unsupported"
    assert "equity" in snapshot.highlights[0].lower()


def test_fundamentals_service_flags_annual_only_history_as_medium_quality(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeAnnualHistoryProvider(),
    )

    snapshot = service.get_snapshot("ANN", cfg=_cfg(), force_refresh=True)

    assert snapshot.freshness_status == "unknown"
    assert snapshot.most_recent_quarter is None
    assert snapshot.historical_series["revenue"].frequency == "annual"
    assert snapshot.data_quality_status == "medium"
    assert "Visible statement history is annual-only, so quarter-level trust is limited." in snapshot.data_quality_flags
    assert "Annual revenue trend is improving." in snapshot.highlights


def test_fundamentals_service_flags_mixed_cadence_as_low_quality(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeMixedCadenceProvider(),
    )

    snapshot = service.get_snapshot("MIX", cfg=_cfg(), force_refresh=True)

    assert snapshot.data_quality_status == "low"
    assert "Revenue YoY mixes snapshot metric data with annual history." in snapshot.data_quality_flags
    assert "Annual revenue trend is improving." in snapshot.highlights


def test_fundamentals_service_flags_outlier_growth_metrics(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeOutlierGrowthProvider(),
    )

    snapshot = service.get_snapshot("OUT", cfg=_cfg(), force_refresh=True)

    assert snapshot.data_quality_status == "low"
    assert "Earnings YoY looks extreme and may reflect a base effect." in snapshot.data_quality_flags


def test_fundamentals_service_does_not_emit_trend_claims_for_non_comparable_history(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeMismatchHistoryProvider(),
    )

    snapshot = service.get_snapshot("MM", cfg=_cfg(), force_refresh=True)

    assert snapshot.historical_series["free_cash_flow_margin"].direction == "not_comparable"
    assert snapshot.data_quality_status == "low"
    assert "FCF margin history is not comparable enough for trend claims." in snapshot.data_quality_flags
    assert "Free cash flow" not in " ".join(snapshot.highlights)
    assert "Quarterly cash-flow conversion is deteriorating." not in snapshot.red_flags


def test_fundamentals_service_derives_book_value_metrics(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        yfinance_provider=_FakeBookValueProvider(),
    )

    snapshot = service.get_snapshot("BOOK", cfg=_cfg(), force_refresh=True)

    assert snapshot.book_value_per_share == 20.0
    assert snapshot.price_to_book == 1.2
    assert snapshot.book_to_price == pytest.approx(1 / 1.2)
    assert snapshot.metric_context["book_value_per_share"].derived is True
    assert snapshot.metric_context["book_value_per_share"].derived_from == [
        "yfinance.balance_sheet",
        "yfinance.info.sharesOutstanding",
    ]
    assert snapshot.metric_context["price_to_book"].derived is True
    assert snapshot.metric_context["book_to_price"].derived is True


def test_fundamentals_service_refreshes_legacy_snapshot_within_ttl(tmp_path):
    storage = FundamentalsStorage(tmp_path / "fundamentals")
    legacy_payload = {
        "symbol": "AAPL",
        "asof_date": "2026-03-19",
        "provider": "yfinance",
        "updated_at": "2099-03-19T10:00:00",
        "instrument_type": "equity",
        "supported": True,
        "coverage_status": "supported",
        "freshness_status": "current",
        "company_name": "Apple Inc.",
        "historical_series": {
            "revenue": {
                "label": "Revenue",
                "unit": "currency",
                "direction": "improving",
                "points": [
                    {"period_end": "2025-11-01", "value": 88_000_000_000.0},
                    {"period_end": "2026-02-01", "value": 94_000_000_000.0},
                ],
            }
        },
        "highlights": ["Recent revenue trend is improving."],
        "metric_sources": {"revenue_growth_yoy": "yfinance"},
    }
    locked_write_json_cli(storage.snapshot_path("AAPL"), legacy_payload)

    service = FundamentalsAnalysisService(
        storage=storage,
        yfinance_provider=_FakeQuarterlyProvider(),
    )

    snapshot = service.get_snapshot("AAPL", cfg=_cfg(), force_refresh=False)

    assert snapshot.metric_context["revenue_growth_yoy"].cadence == "quarterly"
    assert snapshot.historical_series["revenue"].frequency == "quarterly"
    assert snapshot.data_quality_status == "high"
    assert snapshot.data_quality_flags == []


def test_fundamentals_service_uses_sec_provider_first_when_configured(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        sec_edgar_provider=_FakeSecProvider(),
        yfinance_provider=_FakeQuarterlyProvider(),
    )

    cfg = FundamentalsConfig(
        providers=("sec_edgar", "yfinance"),
        cache_ttl_hours=24,
        stale_after_days=120,
        compare_limit=5,
    )
    snapshot = service.get_snapshot("AAPL", cfg=cfg, force_refresh=True)

    assert snapshot.provider == "sec_edgar"
    assert snapshot.symbol == "AAPL"


def test_fundamentals_service_falls_back_to_yfinance_when_sec_provider_fails(tmp_path):
    service = FundamentalsAnalysisService(
        storage=FundamentalsStorage(tmp_path / "fundamentals"),
        sec_edgar_provider=_BrokenSecProvider(),
        yfinance_provider=_FakeQuarterlyProvider(),
    )

    cfg = FundamentalsConfig(
        providers=("sec_edgar", "yfinance"),
        cache_ttl_hours=24,
        stale_after_days=120,
        compare_limit=5,
    )
    snapshot = service.get_snapshot("AAPL", cfg=cfg, force_refresh=True)

    assert snapshot.provider == "yfinance"
    assert snapshot.symbol == "AAPL"
