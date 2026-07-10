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
        ["AAPL", "MSFT"],
        adv_eur={"AAPL": 500_000.0, "MSFT": 40_000.0},
    )
    result = apply_universe_filters(df, cfg)
    assert result.loc["AAPL", "is_eligible"] == True
    assert result.loc["MSFT", "is_eligible"] == False


def test_liquidity_filter_reason_column():
    """Reason column includes 'liquidity' for excluded tickers."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=100_000.0)
    df = _minimal_feature_df(["AAPL"], adv_eur={"AAPL": 40_000.0})
    result = apply_universe_filters(df, cfg)
    assert "liquidity" in result.loc["AAPL", "reason"]


def test_liquidity_filter_zero_means_no_filter():
    """min_avg_daily_volume_eur=0 disables the filter."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=0.0)
    df = _minimal_feature_df(["AAPL"], adv_eur={"AAPL": 1.0})
    result = apply_universe_filters(df, cfg)
    assert result.loc["AAPL", "is_eligible"] == True


def test_liquidity_filter_absent_column_fails_when_threshold_is_required():
    """Missing liquidity data cannot satisfy an active liquidity threshold."""
    cfg = UniverseFilterConfig(min_avg_daily_volume_eur=100_000.0)
    df = _minimal_feature_df(["AAPL"], adv_eur=None)
    result = apply_universe_filters(df, cfg)

    assert result.loc["AAPL", "is_eligible"] == False
    assert "liquidity" in result.loc["AAPL", "reason"]


def test_unknown_currency_fails_active_currency_filter():
    """Unknown quote currency cannot satisfy a USD/EUR universe filter."""
    cfg = UniverseFilterConfig(currencies=["USD", "EUR"], min_avg_daily_volume_eur=0.0)
    df = _minimal_feature_df(["UNKNOWNCUR"])
    df.loc["UNKNOWNCUR", "currency"] = "UNKNOWN"

    result = apply_universe_filters(df, cfg)

    assert result.loc["UNKNOWNCUR", "currency"] == "UNKNOWN"
    assert result.loc["UNKNOWNCUR", "is_eligible"] == False
    assert "currency" in result.loc["UNKNOWNCUR", "reason"]
