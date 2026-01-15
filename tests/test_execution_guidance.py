import numpy as np
import pandas as pd
from pytest import approx

from swing_screener.execution.guidance import add_execution_guidance, ExecutionConfig


def test_breakout_not_triggered_buy_stop():
    df = pd.DataFrame(
        {
            "signal": ["breakout"],
            "last": [100.0],
            "breakout_level": [105.0],
            "atr14": [2.0],
            "ma20_level": [np.nan],
        },
        index=["AAA"],
    )

    out = add_execution_guidance(df)
    row = out.loc["AAA"]

    assert row["suggested_order_type"] == "BUY_STOP"
    assert row["suggested_order_price"] == approx(105.0 * 1.002, rel=1e-9)


def test_breakout_triggered_second_chance_buy_limit():
    df = pd.DataFrame(
        {
            "signal": ["breakout"],
            "last": [110.0],
            "breakout_level": [105.0],
            "atr14": [4.0],
            "ma20_level": [np.nan],
        },
        index=["AAA"],
    )

    out = add_execution_guidance(df)
    row = out.loc["AAA"]

    assert row["suggested_order_type"] == "BUY_LIMIT"
    assert row["suggested_order_price"] == approx(110.0 - 0.25 * 4.0, rel=1e-9)
    assert row["order_price_band_low"] == approx(110.0 - 0.50 * 4.0, rel=1e-9)
    assert row["order_price_band_high"] == approx(110.0 - 0.00 * 4.0, rel=1e-9)


def test_breakout_triggered_no_second_chance_skip():
    df = pd.DataFrame(
        {
            "signal": ["breakout"],
            "last": [110.0],
            "breakout_level": [105.0],
            "atr14": [4.0],
            "ma20_level": [np.nan],
        },
        index=["AAA"],
    )

    cfg = ExecutionConfig(allow_second_chance_breakout=False)
    out = add_execution_guidance(df, cfg)
    row = out.loc["AAA"]

    assert row["suggested_order_type"] == "SKIP"
    assert np.isnan(row["suggested_order_price"])


def test_pullback_buy_limit():
    df = pd.DataFrame(
        {
            "signal": ["pullback"],
            "last": [55.0],
            "breakout_level": [np.nan],
            "atr14": [2.0],
            "ma20_level": [50.0],
        },
        index=["AAA"],
    )

    out = add_execution_guidance(df)
    row = out.loc["AAA"]

    assert row["suggested_order_type"] == "BUY_LIMIT"
    assert row["suggested_order_price"] == approx(50.0, rel=1e-9)
    assert row["order_price_band_low"] == approx(50.0, rel=1e-9)
    assert row["order_price_band_high"] == approx(50.0 + 0.1 * 2.0, rel=1e-9)


def test_none_signal_skip():
    df = pd.DataFrame(
        {
            "signal": ["none"],
            "last": [100.0],
            "breakout_level": [105.0],
            "atr14": [2.0],
            "ma20_level": [50.0],
        },
        index=["AAA"],
    )

    out = add_execution_guidance(df)
    row = out.loc["AAA"]

    assert row["suggested_order_type"] == "SKIP"
    assert np.isnan(row["suggested_order_price"])
