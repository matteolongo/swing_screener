from __future__ import annotations

import pytest

from swing_screener.portfolio.analytics import calculate_portfolio_analytics


def test_initial_risk_and_scratch_semantics() -> None:
    """A missing initial-risk calculation must not enter any closed-trade aggregate."""
    result = calculate_portfolio_analytics(
        [
            {
                "position_id": "win",
                "ticker": "WIN",
                "status": "closed",
                "entry_date": "2026-01-01",
                "exit_date": "2026-01-10",
                "entry_price": 100.0,
                "exit_price": 130.0,
                "initial_risk": 10.0,
                "shares": 4,
                "partial_closes": [
                    {
                        "date": "2026-01-05",
                        "shares_closed": 2,
                        "price": 120.0,
                        "fee_eur": 1.0,
                        "fx_rate": 1.2,
                    }
                ],
                "entry_fee_eur": 1.0,
                "exit_fee_eur": 1.0,
                "tags": ["breakout"],
            },
            {
                "position_id": "loss",
                "ticker": "LOSS",
                "status": "closed",
                "entry_date": "2026-01-02",
                "exit_date": "2026-01-10",
                "entry_price": 100.0,
                "exit_price": 90.0,
                "initial_risk": 10.0,
                "shares": 2,
                "tags": ["breakout"],
            },
            {
                "position_id": "scratch",
                "ticker": "SCRATCH",
                "status": "closed",
                "entry_date": "2026-01-03",
                "exit_date": "2026-01-11",
                "entry_price": 100.0,
                "exit_price": 100.0,
                "initial_risk": 10.0,
                "shares": 1,
                "tags": ["breakout"],
            },
            {
                "position_id": "invalid",
                "ticker": "INVALID",
                "status": "closed",
                "entry_date": "2026-01-03",
                "exit_date": "2026-01-12",
                "entry_price": 100.0,
                "exit_price": 140.0,
                "initial_risk": None,
                "shares": 1,
            },
        ],
        min_tag_sample_size=3,
    )

    # The partial exit contributes 2R for two shares and the final four shares
    # contribute 3R, for a 16R / 6-share result. Fees and FX are cash-accounting
    # fields; R remains the currency-neutral multiple of original per-share risk.
    assert result.closed_trade_count == 3
    assert result.win_count == 1
    assert result.loss_count == 1
    assert result.scratch_count == 1
    assert result.win_rate == pytest.approx(50.0)
    assert result.average_r == pytest.approx(5 / 9)
    assert result.profit_factor == pytest.approx(8 / 3)
    assert result.average_holding_days == pytest.approx(25 / 3)
    assert result.max_win_streak == 1
    assert result.max_loss_streak == 1
    assert [
        (point.position_id, point.r, point.cumulative_r)
        for point in result.equity_curve
    ] == [
        ("loss", -1.0, -1.0),
        ("win", pytest.approx(8 / 3), pytest.approx(5 / 3)),
        ("scratch", 0.0, pytest.approx(5 / 3)),
    ]
    assert result.tag_breakdown[0].tag == "breakout"
    assert result.tag_breakdown[0].trade_count == 3
    assert result.tag_breakdown[0].average_r == pytest.approx(5 / 9)


def test_curve_exposes_backend_computed_trade_detail() -> None:
    result = calculate_portfolio_analytics(
        [
            {
                "position_id": "POS-A",
                "ticker": "AAPL",
                "status": "closed",
                "entry_date": "2026-01-01",
                "exit_date": "2026-01-06",
                "entry_price": 100.0,
                "exit_price": 110.0,
                "initial_risk": 5.0,
                "max_favorable_price": 115.0,
                "shares": 2,
            },
        ]
    )

    point = result.equity_curve[0]
    assert point.ticker == "AAPL"
    assert point.holding_days == 5
    assert point.max_r == pytest.approx(3.0)


def test_canonical_analytics_exposes_journal_rows_filtered_aggregates_and_insight() -> (
    None
):
    """Journal consumers receive partial-close R and every aggregate from Python."""
    result = calculate_portfolio_analytics(
        [
            {
                "position_id": "partial",
                "ticker": "PART",
                "status": "closed",
                "entry_date": "2026-01-01",
                "exit_date": "2026-01-03",
                "entry_price": 100.0,
                "exit_price": 120.0,
                "initial_risk": 10.0,
                "max_favorable_price": 130.0,
                "shares": 1,
                "tags": ["breakout"],
                "partial_closes": [{"shares_closed": 1, "price": 110.0}],
            },
            {
                "position_id": "loss",
                "ticker": "LOSS",
                "status": "closed",
                "entry_date": "2026-01-01",
                "exit_date": "2026-01-04",
                "entry_price": 100.0,
                "exit_price": 90.0,
                "initial_risk": 10.0,
                "max_favorable_price": 105.0,
                "shares": 1,
                "tags": ["breakout", "pullback"],
            },
        ],
        min_tag_sample_size=5,
        insight_min_trade_count=2,
    )

    assert result.equity_curve[0].tags == ("breakout",)
    assert result.equity_curve[0].r == pytest.approx(1.5)
    assert result.average_max_r == pytest.approx(1.75)
    assert result.journal_tag_breakdown[0].tag == "breakout"
    assert result.journal_tag_breakdown[0].trade_count == 2
    assert result.journal_tag_breakdown[0].average_r == pytest.approx(0.25)
    assert result.journal_tag_breakdown[0].average_max_r == pytest.approx(1.75)
    assert result.insight.verdict == "positive"
    assert result.insight.reason == "positive_edge"


def test_idless_rows_and_zero_insight_thresholds_remain_canonical() -> None:
    """Response row identities and configured zeroes must not be fabricated in UI."""
    result = calculate_portfolio_analytics(
        [
            {
                "ticker": "DUPL", "status": "closed", "entry_date": "2026-01-01",
                "exit_date": "2026-01-02", "entry_price": 100, "exit_price": 90,
                "initial_risk": 10, "shares": 1,
            },
            {
                "ticker": "DUPL", "status": "closed", "entry_date": "2026-01-03",
                "exit_date": "2026-01-04", "entry_price": 100, "exit_price": 90,
                "initial_risk": 10, "shares": 1,
            },
        ],
        insight_min_trade_count=1,
        insight_low_win_rate_pct=0,
        insight_min_profit_factor=0,
    )

    assert len({point.position_id for point in result.equity_curve}) == 2
    assert all(
        point.position_id.startswith("analytics-") for point in result.equity_curve
    )
    assert result.insight.reason == "negative_average_r"
    assert result.win_rate_status == "negative"
    assert result.profit_factor_status == "negative"
