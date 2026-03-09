# Portfolio Module

Position lifecycle management, metrics, and data migration utilities.

## Quick Start

```python
from swing_screener.portfolio.state import Position, ManageConfig, load_positions, save_positions

# Load positions from JSON
positions = load_positions("data/positions.json")

# Inspect open positions
open_pos = [p for p in positions if p.status == "open"]
for pos in open_pos:
    print(f"{pos.ticker}: entry={pos.entry_price}, stop={pos.stop_price}, shares={pos.shares}")

# Save updated positions
save_positions("data/positions.json", positions)
```

```python
from swing_screener.portfolio.metrics import calculate_r_now, calculate_pnl

# Calculate current R-multiple for an open position
r_now = calculate_r_now(position, current_price=185.00)
pnl   = calculate_pnl(position.entry_price, current_price=185.00, shares=position.shares)
```

## Key Concepts

### R-Multiple
All position management uses **R-multiples** (multiples of initial risk):
```
1R = entry_price - stop_price      (per share initial risk)
```
When `r_now >= 1.0`, the trade has recovered its initial risk → move stop to breakeven.  
When `r_now >= 2.0`, trail the stop under the 20-bar SMA.

### Source of Truth
Positions are persisted to `data/positions.json` — this is the single source of truth. The ORM in `db.py` is **not used** by the CLI.

## Files

| File | Purpose |
|------|---------|
| `state.py` | `Position`, `ManageConfig`, `PositionUpdate`, load/save, management logic |
| `metrics.py` | P&L, R-multiple, position value calculations |
| `migrate.py` | Data migration: link orders to positions, backfill stop prices |
| `__init__.py` | Package exports |

## Key Classes

### `Position`
```python
@dataclass
class Position:
    ticker:              str
    status:              Literal["open", "closed"]
    entry_date:          str            # ISO date string
    entry_price:         float
    stop_price:          float
    shares:              int
    position_id:         Optional[str]  # UUID, assigned at creation
    source_order_id:     Optional[str]  # linked entry order
    initial_risk:        Optional[float]  # per-share risk at entry
    max_favorable_price: Optional[float]  # highest close seen (for trailing)
    exit_date:           Optional[str]
    exit_price:          Optional[float]
    notes:               str
    exit_order_ids:      Optional[list[str]]
```

### `ManageConfig`
```python
@dataclass
class ManageConfig:
    breakeven_at_R:  float = 1.0    # move stop to entry when R reaches this
    trail_sma:       int   = 20     # SMA window for trailing stop
    trail_after_R:   float = 2.0    # begin trailing when R reaches this
    sma_buffer_pct:  float = 0.005  # trail 0.5% below SMA
    max_holding_days: int  = 20     # time exit after N calendar days
    benchmark:       str   = "SPY"
```

### `PositionUpdate`
Returned by management functions — describes what action (if any) should be taken:
- `NO_ACTION` — no stop change needed
- `MOVE_STOP_UP` — move stop to `stop_suggested`
- `CLOSE_STOP_HIT` — price hit stop, close the position
- `CLOSE_TIME_EXIT` — max holding days exceeded

## Metrics

```python
from swing_screener.portfolio.metrics import (
    calculate_pnl,               # (entry, current, shares) → float
    calculate_per_share_risk,    # (position) → float
    calculate_r_now,             # (position, current_price) → float
    calculate_total_position_value,   # (entry, shares) → float
    calculate_current_position_value, # (current, shares) → float
)
```

## See Also

- `execution/orders.py` — `Order` dataclass and order lifecycle
- `execution/order_workflows.py` — `fill_entry_order()` creates positions from orders
- `risk/position_sizing.py` — computes initial stop and shares
- `cli.py` `manage` command — drives management workflow with `ManageConfig`
