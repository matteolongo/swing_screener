# Execution Module

Order execution, workflows, and guidance for trade management.

## Quick Start

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
| `guidance.py` | `add_execution_guidance()`, `ExecutionConfig` |
| `__init__.py` | Package exports |

Orders, fills and linked exits live in the API's SQL ledger
(`api/services/orders_service.py`, `api/services/portfolio/write.py`,
`api/db/repositories.py`). DeGiro fees are recorded per order/position as
`fee_eur`, `entry_fee_eur` and `exit_fee_eur` through the API.

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

## Order Lifecycle

The API's SQL ledger is the only order store. Its manual-plan lifecycle is `draft → pending → submitted
→ filled`, with unfilled `draft`, `pending` and `submitted` records cancellable
to `cancelled`. `save_as_draft` stores a coherent proposed entry plan without
approval; submission/fill are blocked until a fresh signed review promotes it
through `draft_order_id`. Drafts are excluded from pending exposure. Cancellation
preserves the record and never cancels a broker order. See `api/README.md` and
`data/README.md` for the request contract and migration `20261008_0003`.

Active local `stop` and `take_profit` records are protective ledger entries,
not broker instructions. Position scale-outs resize a full-position protective
record to the remaining shares, and final exits cancel the remaining active
protective records in the same local transaction. If a linked exit is filled,
that record remains historical as `filled` while other protection reconciles.
Users must make the corresponding broker change manually.

## See Also

- `portfolio/state.py` — `Position` and stop management
- `risk/position_sizing.py` — determines `stop_price` and `quantity` before order creation
