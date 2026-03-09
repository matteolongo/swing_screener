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

## `RiskConfig` Reference

```python
@dataclass(frozen=True)
class RiskConfig:
    account_size:          float = 500.0    # ⚠ default is small; always override
    risk_pct:              float = 0.01     # fraction of account risked per trade (1%)
    k_atr:                 float = 2.0      # stop = entry - k_atr * ATR14
    max_position_pct:      float = 0.60     # max position size as fraction of account
    min_shares:            int   = 1        # minimum shares (below this = no trade)
    min_rr:                float = 2.0      # minimum reward-to-risk ratio
    rr_target:             float = 2.0      # take-profit = entry + rr_target * 1R
    commission_pct:        float = 0.0      # broker commission (fraction of trade value)
    max_fee_risk_pct:      float = 0.20     # veto trade if fee > 20% of risk budget
    # Regime-aware scaling (applied before sizing)
    regime_enabled:        bool  = False
    regime_trend_sma:      int   = 200
    regime_trend_multiplier: float = 0.5   # scale risk by 0.5× in downtrend
    regime_vol_atr_window: int   = 14
    regime_vol_atr_pct_threshold: float = 6.0  # ATR% above this = high-vol regime
    regime_vol_multiplier: float = 0.5     # scale risk by 0.5× in high-vol regime
```

> **Note**: `account_size=500.0` is intentionally a minimal default (€500 for a micro account). Always set this to your actual account size in `RiskConfig` or via the strategy config.

## Files

| File | Purpose |
|------|---------|
| `position_sizing.py` | `RiskConfig`, `compute_stop()`, `position_plan()`, `build_trade_plans()` |
| `regime.py` | `compute_regime_risk_multiplier()` — market regime detection |
| `engine.py` | `RiskEngineConfig`, `evaluate_recommendation()` — trade thesis generation |
| `__init__.py` | Package exports |

## See Also

- `selection/pipeline.py` — produces `ranked` and `board` consumed by `build_trade_plans()`
- `portfolio/state.py` — `ManageConfig` for post-entry stop management
- `strategy/plugins/regime_risk/` — strategy plugin for regime-aware scaling
- `strategy/plugins/atr_position_sizing/` — strategy plugin wrapping position sizing
