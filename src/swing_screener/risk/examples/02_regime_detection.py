#!/usr/bin/env python3
"""Regime Detection - Adjust risk based on market conditions."""

import pandas as pd
import numpy as np

from swing_screener.risk import RiskConfig, compute_regime_risk_multiplier


def main():
    # Create sample OHLCV data for SPY (benchmark)
    dates = pd.date_range("2024-01-01", periods=250, freq="D")

    np.random.seed(42)
    base_price = 450
    prices = base_price + np.cumsum(np.random.randn(250) * 2)

    data = {
        "Open": prices * 0.99,
        "High": prices * 1.02,
        "Low": prices * 0.98,
        "Close": prices,
        "Volume": np.random.randint(1000000, 10000000, 250),
    }

    df = pd.DataFrame(data, index=dates)

    # Create MultiIndex columns (field, ticker)
    tickers = ["SPY"]
    cols = [
        (field, ticker)
        for ticker in tickers
        for field in ["Open", "High", "Low", "Close", "Volume"]
    ]
    df.columns = pd.MultiIndex.from_tuples(cols)

    print("Sample OHLCV data created for SPY")
    print(f"Date range: {df.index[0]} to {df.index[-1]}")
    print(f"Latest close: ${df[('Close', 'SPY')].iloc[-1]:.2f}")
    print()

    # Test regime detection with default config
    cfg = RiskConfig(
        regime_enabled=True,
        regime_trend_sma=200,
        regime_trend_multiplier=0.5,
        regime_vol_atr_pct_threshold=6.0,
        regime_vol_multiplier=0.5,
    )

    print("=" * 50)
    print("Testing regime detection (enabled):")
    multiplier, details = compute_regime_risk_multiplier(df, "SPY", cfg)

    print(f"Risk multiplier: {multiplier}")
    print(f"Trend below SMA: {details['trend_below_sma']}")
    print(f"ATR%: {details['atr_pct']}")
    print(f"Reasons: {details['reasons']}")

    # Test with regime disabled
    print("\n" + "=" * 50)
    print("Testing regime detection (disabled):")
    cfg_disabled = RiskConfig(regime_enabled=False)
    multiplier, details = compute_regime_risk_multiplier(df, "SPY", cfg_disabled)

    print(f"Risk multiplier: {multiplier}")
    print(f"Reasons: {details['reasons']}")

    # Test with higher volatility threshold
    print("\n" + "=" * 50)
    print("Testing with higher volatility threshold:")
    cfg_high_vol = RiskConfig(
        regime_enabled=True,
        regime_trend_sma=200,
        regime_trend_multiplier=0.5,
        regime_vol_atr_pct_threshold=3.0,  # Lower threshold
        regime_vol_multiplier=0.5,
    )
    multiplier, details = compute_regime_risk_multiplier(df, "SPY", cfg_high_vol)

    print(f"Risk multiplier: {multiplier}")
    print(f"ATR%: {details['atr_pct']}")
    print(f"Reasons: {details['reasons']}")


if __name__ == "__main__":
    main()
