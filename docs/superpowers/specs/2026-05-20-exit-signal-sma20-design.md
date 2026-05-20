# Exit Signal: SMA20 Technical Deterioration

**Date:** 2026-05-20
**Branch:** feat/exit-signal-sma20 (from feat/compute-analysis-button)

## Problem

App currently exits positions only via mechanical rules (stop hit, time exit). No signal surfaces when the technical trend breaks on an open position. User must notice manually.

## Goal

Surface a daily read-only "Consider Exit" section in the daily review when a position's price closes below SMA20 for 2 or more consecutive days. No auto-action, no LLM, purely deterministic.

## Non-Goals

- No LLM narrative (deferred to v2 when catalyst context is added)
- No automatic order creation
- No dismiss/snooze mechanic
- No momentum or RS signals (deferred to v2)

## Signal Definition

**Condition:** `close[t] < sma20[t]` AND `close[t-1] < sma20[t-1]`

Configurable via `ManageConfig.exit_signal_days: int = 2`.

**Priority:**
1. `CLOSE_STOP_HIT` — stop hit, mechanical close
2. `CLOSE_TIME_EXIT` — time exit, mechanical close
3. `CLOSE_EXIT_SIGNAL` — SMA20 break, advisory
4. `MOVE_STOP_UP` — trail stop (skipped if exit signal fires)
5. `NO_ACTION`

A position showing `CLOSE_EXIT_SIGNAL` does NOT appear in `positions_update_stop`.

**Reason template:**
```
"{ticker} below SMA20 for {n}d ({pct:.1f}% below). {r_now:+.2f}R, {days_open}d held. Stop {stop_dist:.1f}% away."
```

## Architecture

### Backend

**`src/swing_screener/portfolio/state.py`**

- `ManageConfig`: add `exit_signal_days: int = 2`
- `evaluate_positions()`: after stop-hit and time-exit checks, before trail logic:
  - Fetch last `exit_signal_days` rows of Close for ticker from OHLCV
  - Compute SMA20 for those rows
  - If all N closes < SMA20 → action = `CLOSE_EXIT_SIGNAL`
  - Build reason string from template

**`api/models/daily_review.py`**

New model:
```python
class DailyReviewPositionExitSignal(BaseModel):
    position_id: str
    ticker: str
    entry_price: float
    stop_price: float
    current_price: float
    r_now: float
    days_open: int
    sma20: float
    pct_below_sma20: float
    reason: str
```

`DailyReview`: add `positions_exit_signal: list[DailyReviewPositionExitSignal] = []`

**`api/services/daily_review_service.py`**

Map `CLOSE_EXIT_SIGNAL` → `positions_exit_signal`. Do not add to `positions_update_stop`.

### Frontend

**`web-ui/src/features/today/`**

- New section component (read-only, no action buttons)
- i18n key: `today.sections.exitSignal.title` → "Consider Exit"
- Renders ticker, R, days held, reason string
- Follows existing section card pattern

### Config

`ManageConfig.exit_signal_days` can be overridden in `config/strategies.yaml` under the `manage:` key.

## Testing

**Backend:**
- `evaluate_positions()` with OHLCV where last 2 closes < SMA20 → `CLOSE_EXIT_SIGNAL`
- `evaluate_positions()` where only 1 close < SMA20 → no exit signal
- `evaluate_positions()` where stop also hit → `CLOSE_STOP_HIT` wins
- Priority: exit signal does not appear in update_stop list

**Frontend:**
- MSW handler returns `positions_exit_signal` with one item
- Section renders with correct i18n text
- No action buttons rendered

## Data

No changes to `data/positions.json` schema. All signal data derived at runtime from OHLCV.

## Future (v2)

- Add momentum rank drop (needs entry-time rank stored on position)
- Add RS vs SPY deterioration
- Add LLM narrative with catalyst context (news RSS, free tier)
- Add dismiss/snooze with N-day cooldown
