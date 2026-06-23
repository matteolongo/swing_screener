# Backtest

Event-study backtesting: replay the **live** signal/stop/exit decision path over
history to measure expectancy in R-multiples.

## What it is for

A validation harness, not an optimizer. It answers "does this rule change help or
hurt expectancy?" (e.g. `pattern_stop_enabled` on/off, `breakeven_at_R` 1.0 vs
0.5) by replaying the same production functions the live system uses. It must
**not** grow a parameter search: tuning parameters to maximize a historical metric
is curve-fitting, an explicit project non-goal. Compare two hypotheses you formed
for a reason; never sweep a grid for the best number.

## How it works (event study)

For each ticker, walk bars forward. On every bar `T` where the live screener fires
a setup (`build_signal_board`):

1. **Fill** at the next bar's open (`T+1`) — never the close that triggered the
   signal (no lookahead).
2. **Stop** = the live stop placement: `compute_stop` (ATR) then
   `apply_pattern_stop` (structural pattern stop) when `pattern_stop_enabled`.
3. **Forward simulate** by calling the live portfolio manager
   (`evaluate_positions`) on a progressively longer point-in-time slice, one bar
   at a time, applying its `MOVE_STOP_UP` / `CLOSE_*` decisions until it exits.
4. **Record** the round-trip in the ledger with R realized, exit reason, bars
   held, MFE/MAE.

Trades never overlap on the same symbol: a new signal is only considered after the
prior trade closes. R is per-share-normalized (`1R = entry - initial_stop`), so the
ledger measures edge independently of position sizing or currency.

### Fill model

- Entry: `T+1` open.
- Stop hit: fills at the stop level (close-based detection mirrors the live EOD
  manager).
- Time / exit-signal exit: fills at that bar's close.
- Never exited within the data: censored as `open` at the last bar.

## Module layout

| File | Role |
|------|------|
| `config.py` | `BacktestConfig` — bundles the live config surfaces (entry/manage/execution/candles + `k_atr`/`rr_target`); override any field to test a variant |
| `event_study.py` | `run_event_study` — the replay loop; `EventStudyResult` |
| `ledger.py` | `Trade` — one simulated round-trip |
| `metrics.py` | `compute_metrics` / `BacktestMetrics` — R-distribution summary (expectancy, win rate, profit factor, max drawdown in R, per-setup breakdown) |

This module owns no trading logic. It only orchestrates production functions, so a
backtest validates real behaviour rather than a parallel reimplementation. It
raises `swing_screener.errors.DomainError` subclasses (no web framework imports).

## API

Exposed via `POST /api/backtest/event-study` (+ `GET /api/backtest/event-study/{job_id}`
for the async job). See `api/README.md`.

## Known limitations / future work

These are deliberate v1 scope cuts. The optimal solution is recorded here so it is
not forgotten.

- **Universe = today's snapshot → survivorship bias.** v1 backtests whatever tickers
  you pass, using their currently-available history. Delisted/renamed names are
  silently absent, which flatters results. **Optimal:** replay against the dated
  point-in-time universe snapshots already stored in the universe registry, so the
  symbol set at bar `T` is the one that actually existed then.
- **Zero commission and zero slippage.** v1 fills are frictionless (the live config
  also runs `commission_pct: 0.0`). **Optimal:** model `commission_pct` per side and
  a per-trade slippage allowance, plus gap-through-stop fills (a stop fills at the
  gapped open, not the stop level, when a bar opens through it).
- **Event study only — no portfolio model.** Each signal is an independent forward
  outcome; there is no shared capital, concurrent-position cap, or equity curve.
  **Optimal:** a day-by-day portfolio replay layered on the same ledger, producing a
  real equity curve and drawdown benchmarked against SPY buy-and-hold.
- **Cost:** the forward loop re-evaluates `evaluate_positions` on a fresh slice each
  bar (`O(n²)` per ticker). Fine for a handful of manually-chosen symbols; revisit
  before running large universes.
