# Risk Module Optimization Guide

## Responsibility
Provide risk engine configuration, position sizing, and regime-aware risk adjustments.

## Optimization Instructions
1. Avoid constructing temporary DataFrames in hot paths (for example regime/ATR computations).
2. Reuse precomputed volatility/ATR inputs where possible across risk calculations.
3. Minimize repeated config cloning in loops by prebuilding effective config variants.

## Simplification Instructions
1. Extract config-override logic into small helper functions.
2. Keep sizing, regime, and validation steps explicitly separated.

## Definition of Done
- Risk calculations use fewer temporary allocations.
- Config override behavior is explicit and testable.
- Sizing outputs remain consistent with baseline behavior.
