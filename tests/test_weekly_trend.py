import pandas as pd
import pytest
from swing_screener.indicators.trend import compute_weekly_trend_features


def _make_ohlcv(close_series_by_ticker: dict[str, pd.Series]) -> pd.DataFrame:
    """Build a MultiIndex OHLCV DataFrame from per-ticker close series."""
    data = {}
    idx = next(iter(close_series_by_ticker.values())).index
    for ticker, close in close_series_by_ticker.items():
        data[("Close", ticker)] = close
        data[("Open", ticker)] = close * 0.99
        data[("High", ticker)] = close * 1.01
        data[("Low", ticker)] = close * 0.98
        data[("Volume", ticker)] = pd.Series(1_000_000, index=close.index, dtype=float)
    df = pd.DataFrame(data, index=idx)
    df.columns = pd.MultiIndex.from_tuples(df.columns)
    return df


def _rising_series(n_days: int, start: float = 100.0, step: float = 0.1) -> pd.Series:
    idx = pd.bdate_range("2022-01-03", periods=n_days)
    return pd.Series([start + i * step for i in range(n_days)], index=idx, dtype=float)


def _falling_series(n_days: int, start: float = 200.0, step: float = 0.1) -> pd.Series:
    idx = pd.bdate_range("2022-01-03", periods=n_days)
    return pd.Series([start - i * step for i in range(n_days)], index=idx, dtype=float)


def test_weekly_trend_up_for_strongly_rising_series():
    ohlcv = _make_ohlcv({"RISING": _rising_series(400)})
    result = compute_weekly_trend_features(ohlcv)
    assert result.loc["RISING", "weekly_trend"] == "up"


def test_weekly_trend_down_for_strongly_falling_series():
    ohlcv = _make_ohlcv({"FALLING": _falling_series(400)})
    result = compute_weekly_trend_features(ohlcv)
    assert result.loc["FALLING", "weekly_trend"] == "down"


def test_weekly_trend_neutral_for_insufficient_data():
    ohlcv = _make_ohlcv({"SHORT": _rising_series(180)})
    result = compute_weekly_trend_features(ohlcv)
    assert result.loc["SHORT", "weekly_trend"] == "neutral"


def test_weekly_trend_neutral_for_mixed_signals():
    # Create oscillating pattern: down-up-down pattern that crosses SMAs
    idx = pd.bdate_range("2022-01-03", periods=400)
    values = [150.0 + 30.0 * (i % 100 - 50) / 50.0 for i in range(400)]
    series = pd.Series(values, index=idx, dtype=float)
    ohlcv = _make_ohlcv({"MIXED": series})
    result = compute_weekly_trend_features(ohlcv)
    assert result.loc["MIXED", "weekly_trend"] == "neutral"


def test_weekly_trend_returns_dataframe_with_correct_index_name():
    ohlcv = _make_ohlcv({"AAA": _rising_series(400), "BBB": _falling_series(400)})
    result = compute_weekly_trend_features(ohlcv)
    assert result.index.name == "ticker"
    assert set(result.index) == {"AAA", "BBB"}
    assert "weekly_trend" in result.columns


def test_weekly_trend_empty_ohlcv_returns_empty_dataframe():
    cols = pd.MultiIndex.from_product([["Close", "Open", "High", "Low", "Volume"], ["AAA"]])
    ohlcv = pd.DataFrame(columns=cols)
    result = compute_weekly_trend_features(ohlcv)
    assert isinstance(result, pd.DataFrame)
    assert result.empty
