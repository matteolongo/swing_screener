"""Tests for PR6 fundamentals conviction model additions."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from pytest import approx

from swing_screener.fundamentals.scoring import (
    _coverage_penalty_from_pillars,
    _data_confidence_score,
    _freshness_penalty_from_date,
    _revenue_acceleration,
    _linear_slope,
    build_provider_error_snapshot,
    build_snapshot,
)
from swing_screener.fundamentals.models import (
    FundamentalSnapshot,
    FundamentalMetricSeries,
    FundamentalSeriesPoint,
    ProviderFundamentalsRecord,
)
from swing_screener.fundamentals.config import FundamentalsConfig


# ---------------------------------------------------------------------------
# Test 1 – stale data produces non-zero freshness_penalty
# ---------------------------------------------------------------------------

def test_stale_data_produces_freshness_penalty():
    old_date = date.today() - timedelta(days=400)
    penalty = _freshness_penalty_from_date(old_date, date.today())
    assert penalty >= 0.30


# ---------------------------------------------------------------------------
# Test 2 – fresh data produces zero penalty
# ---------------------------------------------------------------------------

def test_fresh_data_produces_no_penalty():
    recent_date = date.today() - timedelta(days=30)
    penalty = _freshness_penalty_from_date(recent_date, date.today())
    assert penalty == 0.0


# ---------------------------------------------------------------------------
# Test 3 – unknown date produces moderate penalty
# ---------------------------------------------------------------------------

def test_unknown_date_produces_moderate_penalty():
    penalty = _freshness_penalty_from_date(None, date.today())
    assert penalty == 0.5


# ---------------------------------------------------------------------------
# Test 4 – partial coverage produces coverage_penalty
# ---------------------------------------------------------------------------

def test_partial_coverage_produces_penalty():
    pillars: dict[str, float | None] = {
        "growth": 0.7,
        "profitability": None,
        "balance_sheet": 0.5,
        "cash_flow": None,
        "valuation": 0.4,
    }
    penalty = _coverage_penalty_from_pillars(pillars)
    assert penalty == approx(2 / 5)


# ---------------------------------------------------------------------------
# Test 5 – revenue acceleration sign reflects direction of trend
# ---------------------------------------------------------------------------

def _make_revenue_series(growth_rates_proxy: list[float]) -> dict[str, FundamentalMetricSeries]:
    """Build a revenue series where consecutive values imply the given growth sequence."""
    # Start at 100 and grow/shrink by the series values
    start = 100.0
    values = [start]
    for g in growth_rates_proxy:
        values.append(values[-1] * (1.0 + g))
    points = [
        FundamentalSeriesPoint(period_end=f"202{i}-12-31", value=v)
        for i, v in enumerate(values)
    ]
    return {
        "revenue": FundamentalMetricSeries(
            label="Revenue",
            unit="currency",
            frequency="annual",
            direction="unknown",
            points=points,
        )
    }


def test_revenue_acceleration_positive_for_accelerating():
    # Growth rates 10% → 15% → 20% → accelerating
    series_map = _make_revenue_series([0.10, 0.15, 0.20])
    result = _revenue_acceleration(series_map)
    assert result is not None
    assert result > 0


def test_revenue_acceleration_negative_for_decelerating():
    # Growth rates 20% → 15% → 10% → decelerating
    series_map = _make_revenue_series([0.20, 0.15, 0.10])
    result = _revenue_acceleration(series_map)
    assert result is not None
    assert result < 0


def test_linear_slope_flat_returns_zero():
    assert _linear_slope([5.0, 5.0, 5.0]) == approx(0.0)


def test_linear_slope_increasing():
    assert _linear_slope([1.0, 2.0, 3.0]) > 0


def test_linear_slope_insufficient_data():
    assert _linear_slope([5.0]) is None


def test_data_confidence_score_uses_multiplicative_plan_formula():
    strong = _data_confidence_score(
        coverage_status="supported",
        freshness_status="current",
        data_quality_status="high",
    )
    partial_stale = _data_confidence_score(
        coverage_status="partial",
        freshness_status="stale",
        data_quality_status="medium",
    )
    weak = _data_confidence_score(
        coverage_status="insufficient",
        freshness_status="unknown",
        data_quality_status="low",
    )

    assert strong == 0.9
    assert partial_stale == 0.2475
    assert weak == 0.0608
    assert 0.0 <= weak <= 1.0
    assert 0.0 <= strong <= 1.0
    assert strong > weak


def test_snapshot_from_dict_missing_confidence_defaults_to_neutral():
    snapshot = FundamentalSnapshot.from_dict(
        {
            "symbol": "AAPL",
            "asof_date": "2026-05-28",
            "provider": "yfinance",
            "updated_at": "2026-05-28T10:00:00",
        }
    )

    assert snapshot.data_confidence_score == 0.5


def test_snapshot_from_dict_malformed_confidence_and_balance_sheet_fields_are_defensive():
    cases = [
        ("bad-assets", {}, [], "bad-score"),
        ("NaN", "Infinity", "-Infinity", "NaN"),
        ("Infinity", "-Infinity", "NaN", "Infinity"),
        ("-Infinity", "NaN", "Infinity", "-Infinity"),
    ]
    for total_assets, total_liabilities, cash_and_equivalents, data_confidence_score in cases:
        snapshot = FundamentalSnapshot.from_dict(
            {
                "symbol": "AAPL",
                "asof_date": "2026-05-28",
                "provider": "yfinance",
                "updated_at": "2026-05-28T10:00:00",
                "total_assets": total_assets,
                "total_liabilities": total_liabilities,
                "cash_and_equivalents": cash_and_equivalents,
                "data_confidence_score": data_confidence_score,
            }
        )

        assert snapshot.total_assets is None
        assert snapshot.total_liabilities is None
        assert snapshot.cash_and_equivalents is None
        assert snapshot.data_confidence_score == 0.5


def test_stale_high_quality_snapshot_marks_source_health_degraded():
    record = ProviderFundamentalsRecord(
        symbol="AAPL",
        asof_date="2026-05-28",
        provider="sec_edgar",
        instrument_type="equity",
        most_recent_quarter="2024-12-31",
        revenue_growth_yoy=0.12,
        earnings_growth_yoy=0.16,
        gross_margin=0.45,
        operating_margin=0.25,
        free_cash_flow_margin=0.18,
        debt_to_equity=40.0,
        current_ratio=1.6,
        return_on_equity=0.22,
        trailing_pe=22.0,
        price_to_sales=5.0,
    )

    snapshot = build_snapshot(
        record,
        FundamentalsConfig(providers=("sec_edgar", "yfinance"), stale_after_days=30),
    )

    assert snapshot.coverage_status == "supported"
    assert snapshot.data_quality_status == "high"
    assert snapshot.freshness_status == "stale"
    assert snapshot.source_health["status"] == "degraded"


def test_provider_error_snapshot_has_zero_confidence_for_failed_source_health():
    snapshot = build_provider_error_snapshot("AAPL", "sec_edgar", "boom")

    assert snapshot.source_health["status"] == "failed"
    assert snapshot.source_health["quality_score"] == 0.0
    assert snapshot.data_confidence_score == 0.0


def test_build_snapshot_propagates_confidence_health_and_sec_balance_sheet_fields():
    record = ProviderFundamentalsRecord(
        symbol="AAPL",
        asof_date="2026-05-28",
        provider="sec_edgar",
        instrument_type="equity",
        most_recent_quarter="2026-03-31",
        revenue_growth_yoy=0.12,
        earnings_growth_yoy=0.16,
        gross_margin=0.45,
        operating_margin=0.25,
        free_cash_flow_margin=0.18,
        debt_to_equity=40.0,
        current_ratio=1.6,
        return_on_equity=0.22,
        trailing_pe=22.0,
        price_to_sales=5.0,
        total_assets=350_000_000_000.0,
        total_liabilities=275_000_000_000.0,
        cash_and_equivalents=55_000_000_000.0,
        latest_filing_form="10-Q",
        latest_filing_date="2026-05-01",
    )

    snapshot = build_snapshot(
        record,
        FundamentalsConfig(providers=("sec_edgar", "yfinance"), stale_after_days=120),
    )

    assert snapshot.total_assets == 350_000_000_000.0
    assert snapshot.total_liabilities == 275_000_000_000.0
    assert snapshot.cash_and_equivalents == 55_000_000_000.0
    assert snapshot.latest_filing_form == "10-Q"
    assert snapshot.latest_filing_date == "2026-05-01"
    assert 0.0 <= snapshot.data_confidence_score <= 1.0
    assert snapshot.source_health["provider"] == "sec_edgar"
    assert snapshot.source_health["quality_score"] == snapshot.data_confidence_score


def _make_record_with_balance_sheet(
    *,
    total_assets: float | None,
    total_liabilities: float | None,
    cash_and_equivalents: float | None,
    debt_to_equity: float | None = None,
    current_ratio: float | None = None,
) -> ProviderFundamentalsRecord:
    return ProviderFundamentalsRecord(
        symbol="TEST",
        asof_date="2026-03-31",
        provider="test",
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        cash_and_equivalents=cash_and_equivalents,
        debt_to_equity=debt_to_equity,
        current_ratio=current_ratio,
    )


def test_net_cash_position_improves_balance_sheet_score():
    record_net_cash = _make_record_with_balance_sheet(
        total_assets=100.0,
        total_liabilities=30.0,
        cash_and_equivalents=40.0,
    )
    record_net_debt = _make_record_with_balance_sheet(
        total_assets=100.0,
        total_liabilities=80.0,
        cash_and_equivalents=10.0,
    )

    snap_cash = build_snapshot(record_net_cash, FundamentalsConfig())
    snap_debt = build_snapshot(record_net_debt, FundamentalsConfig())

    bs_cash = snap_cash.pillars.get("balance_sheet")
    bs_debt = snap_debt.pillars.get("balance_sheet")

    assert bs_cash is not None and bs_debt is not None
    assert bs_cash.score is not None and bs_debt.score is not None
    assert bs_cash.score > bs_debt.score


def test_heavy_net_debt_triggers_red_flag():
    record = _make_record_with_balance_sheet(
        total_assets=100.0,
        total_liabilities=90.0,
        cash_and_equivalents=5.0,
    )
    snap = build_snapshot(record, FundamentalsConfig())
    red_flag_texts = " ".join(snap.red_flags).lower()
    assert "net debt" in red_flag_texts or "debt" in red_flag_texts


def test_no_red_flag_when_net_cash_positive():
    record = _make_record_with_balance_sheet(
        total_assets=100.0,
        total_liabilities=30.0,
        cash_and_equivalents=40.0,
    )
    snap = build_snapshot(record, FundamentalsConfig())
    red_flag_texts = " ".join(snap.red_flags).lower()
    assert "net debt" not in red_flag_texts
