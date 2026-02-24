#!/usr/bin/env python3
"""Position Sizing Basics - Calculate stops and position sizes."""

from swing_screener.risk import RiskConfig, position_plan, compute_stop


def main():
    # Configure risk parameters
    cfg = RiskConfig(
        account_size=50000,
        risk_pct=0.01,  # 1% risk per trade
        k_atr=2.0,  # Stop = entry - 2*ATR
        max_position_pct=0.60,  # Max 60% in one position
        min_shares=10,
        min_rr=2.0,
    )

    print(
        f"Risk Config: ${cfg.account_size} account, {cfg.risk_pct*100}% risk, k_atr={cfg.k_atr}"
    )
    print()

    # Calculate for multiple tickers
    trades = [
        {"ticker": "AAPL", "entry": 175.50, "atr14": 3.25},
        {"ticker": "NVDA", "entry": 485.00, "atr14": 12.50},
        {"ticker": "MSFT", "entry": 375.00, "atr14": 5.75},
    ]

    for trade in trades:
        ticker = trade["ticker"]
        entry = trade["entry"]
        atr14 = trade["atr14"]

        stop = compute_stop(entry, atr14, k_atr=cfg.k_atr)
        plan = position_plan(entry, atr14, cfg)

        print(f"{ticker}: Entry ${entry}, Stop ${stop:.2f}, ATR ${atr14:.2f}")

        if plan:
            risk_pct = (plan["realized_risk"] / cfg.account_size) * 100
            rr = (plan["position_value"] - plan["position_value"]) / plan[
                "realized_risk"
            ]  # placeholder
            print(f"  Shares: {plan['shares']}, Value: ${plan['position_value']:.2f}")
            print(
                f"  Risk: ${plan['realized_risk']:.2f} ({risk_pct:.2f}%), R/R: {rr:.1f}"
            )
        else:
            print("  Not tradable with current parameters")
        print()

    # Test with different k_atr values
    print("=" * 50)
    print("Testing different k_atr values:")
    entry = 175.50
    atr14 = 3.25

    for k in [1.0, 1.5, 2.0, 2.5, 3.0]:
        stop = compute_stop(entry, atr14, k_atr=k)
        plan = position_plan(entry, atr14, cfg)
        if plan:
            print(
                f"k_atr={k}: Stop ${stop:.2f}, Shares={plan['shares']}, Risk=${plan['realized_risk']:.2f}"
            )


if __name__ == "__main__":
    main()
