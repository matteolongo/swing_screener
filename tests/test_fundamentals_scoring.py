"""Tests for PR6 fundamentals conviction model additions."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from pytest import approx

from swing_screener.fundamentals.scoring import (
    _coverage_penalty_from_pillars,
    _freshness_penalty_from_date,
    _revenue_acceleration,
    _linear_slope,
)
from swing_screener.fundamentals.models import (
    FundamentalMetricSeries,
    FundamentalSeriesPoint,
)


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
