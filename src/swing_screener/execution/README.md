# Execution Module

Order execution, workflows, and guidance for trade management.

## Quick Start

```python
from swing_screener.execution import Order, load_orders, save_orders

# Create an order
order = Order(
    order_id="ORD-001",
    ticker="AAPL",
    status="pending",
    order_type="BUY_LIMIT",
    quantity=100,
    limit_price=175.00,
    order_date="2024-01-15",
)

# Save orders to JSON
save_orders("orders.json", [order])
```

```python
from swing_screener.execution import fill_entry_order, fill_exit_order_dicts
from swing_screener.portfolio.state import Position

# Fill an entry order - creates position + auto-linked stop/take-profit
new_orders, new_positions = fill_entry_order(
    orders=[entry_order],
    positions=[],
    order_id="ORD-001",
    fill_price=175.50,
    fill_date="2024-01-16",
    quantity=100,
    stop_price=170.00,
    tp_price=185.00,
)
```

```python
# Generate execution guidance from screener results
from swing_screener.execution.guidance import add_execution_guidance, ExecutionConfig

cfg = ExecutionConfig(
    breakout_stop_buffer_pct=0.002,
    pullback_atr_fraction=0.25,
    allow_second_chance_breakout=True,
)
report = add_execution_guidance(screener_df, cfg)
```

When `cfg` is omitted, `add_execution_guidance()` constructs a fresh
YAML-backed `ExecutionConfig` at call time. Report generation passes its
request-scoped `ReportConfig.execution` instance explicitly.

## Files

| File | Purpose |
|------|---------|
| `orders.py` | `Order` dataclass, `load_orders()`, `save_orders()` |
| `order_workflows.py` | `fill_entry_order()`, `scale_in_fill()`, `normalize_orders()` |
| `orders_service.py` | Dict ↔ model conversions for API layer |
| `guidance.py` | `add_execution_guidance()`, `ExecutionConfig` |
| `degiro_fees.py` | Import DeGiro broker fees from CSV export |
| `providers/` | Fee calculators per broker |
| `__init__.py` | Package exports |

The API-layer order-review boundary lives in
`api/services/order_approval.py`. Its pure
`resolve_execution_eligibility(candidate, require_approval=False)` resolver
combines execution guidance with the canonical recommendation, freshness,
validated plan, quote currency, same-symbol mode, and approval identity. Core
execution guidance does not independently authorize order review. The default
is the screener's pre-token phase; callers validating an already-issued
candidate may set `require_approval=True`.

## Canonical Order-Review Eligibility

Screener responses expose a discriminated `execution_eligibility` result.
Allowed results carry exactly one mode, `ready` or `pending_pullback`; blocked
results carry exactly one stable reason: `skip_guidance`,
`workflow_not_actionable`, `approval_missing`, `data_not_current`,
`plan_incomplete`, `plan_invalid`, or `held_symbol_not_add_on`. Every blocked
result has a null `canonical_order_draft`.

An allowed canonical draft contains only validated `BUY_LIMIT` or `BUY_STOP`
details: entry, stop, target, positive integer shares, R:R, a registered quote
currency, and the approval token. Prices must be finite and positive and obey
`stop < entry < target`. The screener first resolves every non-token gate, then
issues approval identity; if identity cannot be issued, it replaces the
provisional allowed result with `approval_missing` and removes the draft.

The only waiting workflow eligible for manual review is
`waiting_trigger` / `wait_pullback` with pending `BUY_LIMIT` guidance and an
approval token. Its mode is `pending_pullback`, not `ready`. `SKIP` is never an
executable signal: it cannot produce approval claims, a token, or a draft even
if an earlier analytical signal looked actionable.

## DeGiro Fee Import

```python
from swing_screener.execution.degiro_fees import import_degiro_fees

updated_orders = import_degiro_fees(
    orders=orders,
    degiro_csv_path="degiro_export.csv",
    fx_rate=1.08,          # EUR/USD if orders are in USD
)
```

DeGiro fee records are matched to filled orders by ticker and date, then stored in `order.fee_eur`.

## Order Lifecycle

```
pending → filled     (fill_entry_order / fill_exit_order)
pending → cancelled  (cancel_order)
```

Orders are persisted to `data/orders.json`. Use `load_orders()` / `save_orders()` for all reads and writes — never edit the JSON directly while the CLI is running (file locking is active).

## Notes

- `fill_entry_order()` automatically creates linked stop and take-profit orders.
- `scale_in_fill()` adds shares to an existing open position without creating a new position record.
- `normalize_orders()` deduplicates and cleans order lists after import operations.
- `orders_service.py` provides dict-based wrappers consumed by the FastAPI endpoints.

## See Also

- `portfolio/state.py` — `Position` created from a filled entry order
- `risk/position_sizing.py` — determines `stop_price` and `quantity` before order creation
- `cli.py` `orders` command — drives the order lifecycle from the terminal
