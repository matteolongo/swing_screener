# Short-Term 5D Strategy Design

## Goal

Add a separately selectable short-term momentum strategy aimed at closing positions within five trading bars while preserving the existing `Balanced` strategy unchanged.

## Strategy behavior

The new strategy will use the existing deterministic momentum module and daily end-of-day workflow with these defaults:

- 20-bar breakout lookback.
- 10-bar pullback-reclaim moving average.
- 252 bars of minimum history so indicators remain stable and comparable.
- Five-trading-bar hard maximum holding period.
- One consecutive close below the trailing moving average as an advisory exit signal.
- Breakeven protection at `+0.75R`.
- Trailing begins at `+1R` using the existing SMA trail with a five-bar window.
- A two-R target remains a planned/validated order target, not an implicit automatic exit.

The strategy will be added to `config/strategies.yaml` with its own ID and will not become active automatically. The current `active_strategy_id: default` remains unchanged.

## Configuration propagation

`exit_signal_days` will be added to the typed strategy API model and mapped by `build_manage_config()`. This ensures YAML/API strategy definitions, live position review, and event-study backtests all consume the same management configuration.

## Testing

Regression tests will cover:

1. The new strategy exists with the intended short-term settings.
2. `build_manage_config()` preserves a configured `exit_signal_days` value.
3. A position reaches `CLOSE_TIME_EXIT` at the five-bar cap.
4. A single close below the configured SMA produces `CLOSE_EXIT_SIGNAL` for the short-term configuration.

Existing `Balanced` behavior and existing portfolio-management tests must remain unchanged.

## Scope boundaries

This change does not add intraday data, automatic broker execution, or a new take-profit exit path. Because the app is EOD/manual by design, broker-native stop and limit orders remain necessary to protect positions between daily reviews.
