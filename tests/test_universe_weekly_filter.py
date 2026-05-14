from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from swing_screener.selection.universe import UniverseFilterConfig, apply_universe_filters
from swing_screener.selection.pipeline import build_selection_pipeline
from swing_screener.selection.universe import UniverseConfig
from swing_screener.selection.ranking import RankingConfig
from swing_screener.selection.entries import EntrySignalConfig
from swing_screener.indicators.trend import TrendConfig
from swing_screener.indicators.volatility import VolatilityConfig
from swing_screener.indicators.momentum import MomentumConfig


def _feature_df(tickers: list[str], weekly_trends: dict[str, str]) -> pd.DataFrame:
    """Minimal feature DataFrame with weekly_trend column."""
    data = {
        "last": {t: 20.0 for t in tickers},
        "atr_pct": {t: 3.0 for t in tickers},
        "trend_ok": {t: True for t in tickers},
        "rs_6m": {t: 0.05 for t in tickers},
        "currency": {t: "USD" for t in tickers},
        "weekly_trend": {t: weekly_trends.get(t, "neutral") for t in tickers},
    }
    return pd.DataFrame(data, index=pd.Index(tickers, name="ticker"))


def test_require_weekly_uptrend_excludes_down_and_neutral():
    cfg = UniverseFilterConfig(require_weekly_uptrend=True)
    df = _feature_df(["UP", "DOWN", "NEUTRAL"], {"UP": "up", "DOWN": "down", "NEUTRAL": "neutral"})
    result = apply_universe_filters(df, cfg)
    assert result.loc["UP", "is_eligible"] == True
    assert result.loc["DOWN", "is_eligible"] == False
    assert result.loc["NEUTRAL", "is_eligible"] == False


def test_require_weekly_uptrend_false_passes_all():
    cfg = UniverseFilterConfig(require_weekly_uptrend=False)
    df = _feature_df(["UP", "DOWN", "NEUTRAL"], {"UP": "up", "DOWN": "down", "NEUTRAL": "neutral"})
    result = apply_universe_filters(df, cfg)
    assert result.loc["UP", "is_eligible"] == True
    assert result.loc["DOWN", "is_eligible"] == True
    assert result.loc["NEUTRAL", "is_eligible"] == True


def test_weekly_trend_failure_appears_in_reason():
    cfg = UniverseFilterConfig(require_weekly_uptrend=True)
    df = _feature_df(["DOWN"], {"DOWN": "down"})
    result = apply_universe_filters(df, cfg)
    assert "weekly_trend" in result.loc["DOWN", "reason"]


def test_weekly_trend_absent_column_treated_as_neutral():
    """When weekly_trend column is missing and filter is on, ticker is excluded."""
    cfg = UniverseFilterConfig(require_weekly_uptrend=True)
    data = {
        "last": {"AAA": 20.0},
        "atr_pct": {"AAA": 3.0},
        "trend_ok": {"AAA": True},
        "rs_6m": {"AAA": 0.05},
        "currency": {"AAA": "USD"},
        # no weekly_trend column
    }
    df = pd.DataFrame(data, index=pd.Index(["AAA"], name="ticker"))
    result = apply_universe_filters(df, cfg)
    assert result.loc["AAA", "is_eligible"] == False


def test_pipeline_board_contains_weekly_trend():
    """build_selection_pipeline propagates weekly_trend onto the signal board."""
    n = 400
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    rng = np.random.default_rng(42)
    prices = 25.0 + np.arange(n) * 0.05 + rng.normal(0, 0.2, n)
    prices = np.abs(prices)
    # SPY is required as a benchmark for compute_momentum_features (rs_6m = mom - benchmark_mom).
    # Without SPY in the close matrix, momentum features return empty and the pipeline
    # produces an empty board.
    prices_spy = 300.0 + rng.normal(0, 1.0, n)
    prices_spy = np.abs(prices_spy)

    close = pd.Series(prices, index=dates)
    close_spy = pd.Series(prices_spy, index=dates)
    volume = pd.Series([1_000_000.0] * n, index=dates)

    ticker = "AAAA"
    ohlcv = pd.DataFrame(
        {
            ("Open", ticker): close * 0.99,
            ("High", ticker): close * 1.01,
            ("Low", ticker): close * 0.98,
            ("Close", ticker): close,
            ("Volume", ticker): volume,
            ("Open", "SPY"): close_spy * 0.99,
            ("High", "SPY"): close_spy * 1.01,
            ("Low", "SPY"): close_spy * 0.98,
            ("Close", "SPY"): close_spy,
            ("Volume", "SPY"): volume,
        }
    )
    ohlcv.index = dates

    cfg = UniverseConfig(
        trend=TrendConfig(),
        vol=VolatilityConfig(atr_window=14),
        mom=MomentumConfig(benchmark="SPY"),
        filt=UniverseFilterConfig(
            min_price=1.0,
            max_price=500.0,
            max_atr_pct=100.0,
            require_trend_ok=False,
            require_rs_positive=False,
            require_weekly_uptrend=False,
            currencies=["USD"],
        ),
    )

    result = build_selection_pipeline(
        ohlcv,
        universe_cfg=cfg,
        ranking_cfg=RankingConfig(),
        entry_cfg=EntrySignalConfig(min_history=200),
    )

    assert not result.board.empty, "board should have at least one row"
    assert "weekly_trend" in result.board.columns
    assert result.board["weekly_trend"].isin(["up", "down", "neutral"]).all()
