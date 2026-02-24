#!/usr/bin/env python3
"""Trade Plans - Build position plans for a universe of signals."""

import pandas as pd
import numpy as np

from swing_screener.risk import RiskConfig, build_trade_plans


def main():
    # Create sample ranked universe
    tickers = ["AAPL", "NVDA", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AMD"]

    universe_data = {
        "ticker": tickers,
        "atr14": [3.25, 12.50, 5.75, 2.80, 3.50, 4.20, 8.00, 5.00],
        "last": [175.50, 485.00, 375.00, 142.00, 178.00, 485.00, 245.00, 125.00],
    }
    ranked_universe = pd.DataFrame(universe_data).set_index("ticker")

    # Create sample signal board
    signal_data = {
        "ticker": tickers,
        "signal": [
            "both",
            "breakout",
            "pullback",
            "none",
            "breakout",
            "pullback",
            "none",
            "both",
        ],
        "last": [175.50, 485.00, 375.00, 142.00, 178.00, 485.00, 245.00, 125.00],
    }
    signal_board = pd.DataFrame(signal_data).set_index("ticker")

    print("Sample Data:")
    print("\nRanked Universe:")
    print(ranked_universe)
    print("\nSignal Board:")
    print(signal_board)

    # Configure risk
    cfg = RiskConfig(
        account_size=50000,
        risk_pct=0.01,
        k_atr=2.0,
        max_position_pct=0.60,
        min_rr=2.0,
    )

    # Build trade plans
    print("\n" + "=" * 50)
    print("Building trade plans:")
    plans = build_trade_plans(ranked_universe, signal_board, cfg)

    if not plans.empty:
        print(
            plans[
                ["signal", "shares", "entry", "stop", "position_value", "realized_risk"]
            ]
        )
    else:
        print("No tradeable signals")

    # With risk multipliers (reduce risk for some tickers)
    print("\n" + "=" * 50)
    print("With risk multipliers:")
    risk_multipliers = {
        "NVDA": 0.5,  # Half risk for high-volatility
        "TSLA": 0.5,
    }
    plans_adjusted = build_trade_plans(
        ranked_universe, signal_board, cfg, risk_multipliers=risk_multipliers
    )

    if not plans_adjusted.empty:
        print(plans_adjusted[["signal", "shares", "position_value", "realized_risk"]])

    # With vetoes
    print("\n" + "=" * 50)
    print("With vetoes (excluding AAPL, NVDA):")
    plans_vetoed = build_trade_plans(
        ranked_universe, signal_board, cfg, vetoes={"AAPL", "NVDA"}
    )

    if not plans_vetoed.empty:
        print(plans_vetoed[["signal", "shares", "entry", "stop"]])


if __name__ == "__main__":
    main()
