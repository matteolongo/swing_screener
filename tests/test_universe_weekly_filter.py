from __future__ import annotations

import pandas as pd
import pytest

from swing_screener.selection.universe import UniverseFilterConfig, apply_universe_filters


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
