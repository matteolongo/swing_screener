# Utils Module

Shared utility functions used across the project: data helpers, date utilities, file locking, and DataFrame operations.

## Quick Start

```python
from swing_screener.utils import get_nested_dict, normalize_tickers
from swing_screener.utils.date_helpers import get_lookback_start_date, to_iso_date
from swing_screener.utils.file_lock import locked_read_json_cli, locked_write_json_cli
from swing_screener.utils.dataframe_helpers import get_close_matrix, sma
```

## Files

| File | Purpose |
|------|---------|
| `helpers.py` | `normalize_tickers()`, `get_nested_dict()` |
| `date_helpers.py` | Dynamic date calculation (lookback, YTD, ISO conversion) |
| `file_lock.py` | Thread-safe JSON read/write using `portalocker` |
| `dataframe_helpers.py` | OHLCV field extraction, SMA/EMA helpers |

## Function Reference

### `helpers.py`

```python
normalize_tickers(tickers) -> list[str]
# Deduplicate, strip, uppercase. Raises ValueError if result is empty.

get_nested_dict(payload, *keys, default=None) -> dict
# Safely traverse nested dicts without KeyError.
# get_nested_dict(cfg, "risk", "sizing") → {} if path doesn't exist
```

### `date_helpers.py`

```python
get_lookback_start_date(years=1, from_date=None) -> str   # "2025-03-08"
get_default_history_start(years=1) -> str                 # alias for above
get_ytd_start_date(from_date=None) -> str                 # "2026-01-01"
to_iso_date(timestamp) -> Optional[str]                   # None | str | datetime | pd.Timestamp → "YYYY-MM-DD"
```

`get_lookback_start_date` uses `365 * years` (not calendar-aware) — sufficient for historical data queries where a few days of imprecision is acceptable.

### `file_lock.py`

Thread-safe file operations using `portalocker`. Timeouts are enforced with explicit non-blocking retry semantics (`LOCK_NB` with shared/exclusive locks as appropriate). Falls back to unlocked I/O if `portalocker` is not installed.

```python
locked_read_json_cli(path: Path, timeout=5.0) -> Any
locked_write_json_cli(path: Path, data: dict | list, timeout=5.0) -> None
locked_write_text_cli(path: Path, text: str, timeout=5.0) -> None
```

Used by `portfolio/state.py` and `execution/orders.py` to prevent concurrent writes from multiple CLI processes.

### `dataframe_helpers.py`

```python
get_close_matrix(ohlcv) -> pd.DataFrame      # (field, ticker) MultiIndex → (date x ticker) close prices
get_field_matrix(ohlcv, field) -> pd.DataFrame  # same but for any OHLCV field
sma(series, period, min_periods=None) -> pd.Series  # simple rolling average
ema(series, span, min_periods=0) -> pd.Series       # exponential moving average
```

All indicator functions in `indicators/` use `get_close_matrix()` as their first step.

## Notes

- `DEFAULT_TIMEOUT = 5.0` seconds for file lock acquisition — configurable per call.
- Shared reads use `LOCK_SH | LOCK_NB`; writes and atomic updates use `LOCK_EX | LOCK_NB`.
- If `portalocker` is unavailable (e.g., in test environments), file operations proceed without locking and a warning is logged.
- `normalize_tickers()` is idempotent and order-preserving (first occurrence wins).

## See Also

- `portfolio/state.py` — uses `locked_read_json_cli` / `locked_write_json_cli`
- `execution/orders.py` — uses `locked_read_json_cli` / `locked_write_json_cli`
- `indicators/` — uses `get_close_matrix`, `sma`
