from __future__ import annotations

from swing_screener.fundamentals.models import (
    FundamentalMetricContext,
    FundamentalMetricSeries,
    FundamentalPillarScore,
    FundamentalSeriesPoint,
    FundamentalSnapshot,
)
from swing_screener.fundamentals.storage import FundamentalsStorage
from swing_screener.utils.file_lock import locked_write_json_cli


def test_fundamentals_snapshot_roundtrip_preserves_trust_metadata(tmp_path):
    storage = FundamentalsStorage(tmp_path / "fundamentals")
    snapshot = FundamentalSnapshot(
        symbol="SBMO.AS",
        asof_date="2026-03-19",
        provider="yfinance",
        updated_at="2026-03-19T09:30:00",
        instrument_type="equity",
        supported=True,
        coverage_status="supported",
        freshness_status="unknown",
        company_name="SBM Offshore N.V.",
        currency="EUR",
        shares_outstanding=650_000_000.0,
        total_equity=6_500_000_000.0,
        book_value_per_share=10.0,
        price_to_book=1.7,
        book_to_price=0.5882,
        most_recent_quarter=None,
        pillars={
            "growth": FundamentalPillarScore(score=0.76, status="strong", summary="Growth profile."),
        },
        historical_series={
            "operating_margin": FundamentalMetricSeries(
                label="Operating margin",
                unit="percent",
                frequency="annual",
                direction="not_comparable",
                source="yfinance.financials",
                derived_from=[
                    "yfinance.financials",
                    "yfinance.cashflow",
                ],
                points=[
                    FundamentalSeriesPoint(period_end="2023-12-31", value=0.24),
                    FundamentalSeriesPoint(period_end="2024-12-31", value=0.19),
                ],
            ),
        },
        metric_context={
            "operating_margin": FundamentalMetricContext(
                source="yfinance.financials",
                cadence="annual",
                derived=True,
                derived_from=[
                    "yfinance.financials",
                    "yfinance.cashflow",
                ],
                period_end="2024-12-31",
            ),
        },
        data_quality_status="medium",
        data_quality_flags=[
            "Visible statement history is annual-only, so quarter-level trust is limited.",
        ],
        highlights=[
            "Margins are improving.",
            "Profitability profile looks healthy.",
        ],
    )

    storage.save_snapshot(snapshot)
    loaded = storage.load_snapshot("sbmo.as")

    assert loaded is not None
    assert loaded.historical_series["operating_margin"].unit == "percent"
    assert loaded.historical_series["operating_margin"].frequency == "annual"
    assert loaded.historical_series["operating_margin"].direction == "not_comparable"
    assert loaded.historical_series["operating_margin"].source == "yfinance.financials"
    assert loaded.metric_context["operating_margin"].cadence == "annual"
    assert loaded.metric_context["operating_margin"].derived is True
    assert loaded.metric_context["operating_margin"].derived_from == [
        "yfinance.financials",
        "yfinance.cashflow",
    ]
    assert loaded.book_value_per_share == 10.0
    assert loaded.price_to_book == 1.7
    assert loaded.book_to_price == 0.5882
    assert loaded.data_quality_status == "medium"
    assert loaded.data_quality_flags == [
        "Visible statement history is annual-only, so quarter-level trust is limited.",
    ]
    assert loaded.highlights == ["Profitability profile looks healthy."]


def test_fundamentals_snapshot_roundtrip_keeps_new_fields_optional_for_legacy_payloads(tmp_path):
    storage = FundamentalsStorage(tmp_path / "fundamentals")
    locked_write_json_cli(
        storage.snapshot_path("legacy"),
        {
            "symbol": "LEGACY",
            "asof_date": "2026-03-19",
            "provider": "yfinance",
            "updated_at": "2026-03-19T09:30:00",
            "instrument_type": "equity",
            "supported": True,
            "coverage_status": "supported",
            "freshness_status": "current",
            "pillars": {
                "growth": {"score": 0.76, "status": "strong", "summary": "Growth profile."},
            },
        },
    )

    loaded = storage.load_snapshot("legacy")

    assert loaded is not None
    assert loaded.book_value_per_share is None
    assert loaded.price_to_book is None
    assert loaded.book_to_price is None
