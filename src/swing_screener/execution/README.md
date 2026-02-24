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

## Submodules

| Module | Description |
|--------|-------------|
| `orders` | Order model, load/save from JSON |
| `order_workflows` | Fill entry/exit orders, scale-in logic |
| `orders_service` | Dict-to-model conversions for API |
| `guidance` | Generate execution instructions from signals |
| `degiro_fees` | DeGiro broker fee calculations |
