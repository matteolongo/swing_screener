# Risk Module

Position sizing, risk management, and market regime detection.

## Quick Start

```python
from swing_screener.risk import RiskConfig, position_plan, compute_stop

# Configure risk parameters
cfg = RiskConfig(
    account_size=50000,
    risk_pct=0.01,      # 1% risk per trade
    k_atr=2.0,          # Stop = entry - 2*ATR
    max_position_pct=0.60,
    min_rr=2.0,
)

# Calculate stop and position size
entry = 175.50
atr14 = 3.25

stop = compute_stop(entry, atr14, k_atr=2.0)
plan = position_plan(entry, atr14, cfg)

print(f"Entry: ${entry}, Stop: ${stop}")
print(f"Shares: {plan['shares']}, Value: ${plan['position_value']}")
print(f"Risk: ${plan['realized_risk']} ({plan['realized_risk']/cfg.account_size*100:.2f}%)")
```

```python
# Regime-aware risk scaling
from swing_screener.risk import compute_regime_risk_multiplier

cfg = RiskConfig(
    account_size=50000,
    regime_enabled=True,
    regime_trend_sma=200,
    regime_trend_multiplier=0.5,
    regime_vol_atr_pct_threshold=6.0,
    regime_vol_multiplier=0.5,
)

multiplier, details = compute_regime_risk_multiplier(ohlcv, "SPY", cfg)
print(f"Risk multiplier: {multiplier}")
print(f"Reasons: {details['reasons']}")
```

```python
# Build trade plans for universe
from swing_screener.risk import build_trade_plans, RiskConfig

plans = build_trade_plans(ranked_universe, signal_board, cfg)
print(plans.head())
```

## Submodules

| Module | Description |
|--------|-------------|
| `position_sizing` | Position sizing, stop calculation, trade plans |
| `regime` | Market regime detection for risk scaling |
| `engine` | Risk evaluation with Trade Thesis generation |
