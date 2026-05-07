from __future__ import annotations

import pandas as pd
import pytest

from swing_screener.selection.universe import UniverseFilterConfig, apply_universe_filters


def _minimal_feature_df(tickers: list[str], adv_eur: dict[str, float] | None = None) -> pd.DataFrame:
    """Build a minimal feature DataFrame for filter testing."""
    data: dict[str, dict] = {
        "last": {t: 20.0 for t in tickers},
        "atr_pct": {t: 3.0 for t in tickers},
        "trend_ok": {t: True for t in tickers},
        "rs_6m": {t: 0.05 for t in tickers},
        "currency": {t: "USD" for t in tickers},
    }
    if adv_eur is not None:
        data["avg_daily_volume_eur"] = {t: adv_eur.get(t, 0.0) for t in tickers}
    return pd.DataFrame(data, index=pd.Index(tickers, name="ticker"))


def test_liquidity_filter_removes_illiquid():
    """Tickers below min_avg_daily_volume_eur are excluded."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=100_000.0)
    df = _minimal_feature_df(
        ["LIQUID", "ILLIQUID"],
        adv_eur={"LIQUID": 500_000.0, "ILLIQUID": 40_000.0},
    )
    result = apply_universe_filters(df, cfg)
    assert result.loc["LIQUID", "is_eligible"] == True
    assert result.loc["ILLIQUID", "is_eligible"] == False


def test_liquidity_filter_reason_column():
    """Reason column includes 'liquidity' for excluded tickers."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=100_000.0)
    df = _minimal_feature_df(["ILLIQUID"], adv_eur={"ILLIQUID": 40_000.0})
    result = apply_universe_filters(df, cfg)
    assert "liquidity" in result.loc["ILLIQUID", "reason"]


def test_liquidity_filter_zero_means_no_filter():
    """min_avg_daily_volume_eur=0 disables the filter."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=0.0)
    df = _minimal_feature_df(["LOW_VOL"], adv_eur={"LOW_VOL": 1.0})
    result = apply_universe_filters(df, cfg)
    assert result.loc["LOW_VOL", "is_eligible"] == True


def test_liquidity_filter_absent_column_passes():
    """When avg_daily_volume_eur column is absent, filter is skipped — no KeyError."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=100_000.0)
    # Build df without avg_daily_volume_eur column
    df = _minimal_feature_df(["NOVOLDATA"], adv_eur=None)
    result = apply_universe_filters(df, cfg)
    # Should not raise; ticker passes (filter skipped when column absent)
    assert result.loc["NOVOLDATA", "is_eligible"] == True
