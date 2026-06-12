"""Tests for swing_screener.utils.dataframe_helpers (previously untested)."""
import pandas as pd
import pytest

from swing_screener.utils.dataframe_helpers import (
    ema,
    get_close_matrix,
    get_field_matrix,
    sma,
)


def _ohlcv(tickers):
    idx = pd.bdate_range("2024-01-01", periods=5)
    fields = ["Open", "High", "Low", "Close", "Volume"]
    cols = pd.MultiIndex.from_product([fields, tickers], names=["field", "ticker"])
    data = {}
    for i, t in enumerate(tickers):
        base = 100.0 + 10 * i
        data[("Open", t)] = [base] * 5
        data[("High", t)] = [base + 2] * 5
        data[("Low", t)] = [base - 2] * 5
        data[("Close", t)] = [base + j for j in range(5)]
        data[("Volume", t)] = [1000 + j for j in range(5)]
    return pd.DataFrame(data, index=idx, columns=cols)


def test_get_close_matrix_multi_ticker_returns_close_columns():
    close = get_close_matrix(_ohlcv(["AAPL", "MSFT"]))
    assert list(close.columns) == ["AAPL", "MSFT"]
    assert close.loc[:, "AAPL"].iloc[-1] == 104.0


def test_get_close_matrix_single_ticker_is_dataframe():
    close = get_close_matrix(_ohlcv(["AAPL"]))
    assert isinstance(close, pd.DataFrame)
    assert list(close.columns) == ["AAPL"]


def test_get_close_matrix_raises_without_multiindex():
    flat = pd.DataFrame({"Close": [1, 2, 3]})
    with pytest.raises(ValueError, match="MultiIndex"):
        get_close_matrix(flat)


def test_get_close_matrix_raises_when_close_missing():
    df = _ohlcv(["AAPL"]).drop(columns="Close", level=0)
    with pytest.raises(ValueError, match="Close"):
        get_close_matrix(df)


def test_get_field_matrix_returns_requested_field():
    vol = get_field_matrix(_ohlcv(["AAPL", "MSFT"]), "Volume")
    assert list(vol.columns) == ["AAPL", "MSFT"]
    assert vol.loc[:, "MSFT"].iloc[0] == 1000


def test_get_field_matrix_raises_for_unknown_field():
    with pytest.raises(ValueError, match="Vwap"):
        get_field_matrix(_ohlcv(["AAPL"]), "Vwap")


def test_sma_matches_manual_rolling_mean():
    s = pd.Series([10.0, 20.0, 30.0, 40.0])
    result = sma(s, period=2)
    assert pd.isna(result.iloc[0])
    assert result.iloc[1] == 15.0
    assert result.iloc[3] == 35.0


def test_sma_min_periods_allows_partial_window():
    s = pd.Series([10.0, 20.0, 30.0])
    result = sma(s, period=3, min_periods=1)
    assert result.iloc[0] == 10.0  # partial window allowed
    assert result.iloc[2] == 20.0


def test_ema_first_value_equals_seed_with_adjust_false():
    s = pd.Series([10.0, 20.0, 30.0])
    result = ema(s, span=2)
    assert result.iloc[0] == 10.0  # adjust=False seeds with first value
    assert result.iloc[-1] > result.iloc[0]
