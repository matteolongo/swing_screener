# UI Refactor Plan (app.py)

Goal: reduce `ui/app.py` size and separate UI rendering from business logic and I/O.

## Why
- `ui/app.py` mixes UI layout, data fetching, business logic, and file I/O.
- Harder to test and maintain; changes in one area risk regressions elsewhere.

## Target layout
```
ui/
  app.py
  settings.py
  flows/
    screener.py
    manage.py
    backtest.py
    quick_backtest.py
  components/
    candidates.py
    orders.py
    manage.py
    backtest.py
  render.py
```

## Extraction candidates

1) Settings + session state
- Move: `DEFAULT_SETTINGS`, `_init_settings`, `_current_settings`, sidebar form
- To: `ui/settings.py`
- Exports: `DEFAULT_SETTINGS`, `init_settings()`, `current_settings()`, `render_sidebar_settings()`

2) Screener flow (business + I/O)
- Move: `_run_screener`, report CSV writing, metadata enrichment
- To: `ui/flows/screener.py` or `src/swing_screener/reporting/workflow.py`
- Exports: `run_screener(settings) -> report, csv_text`

3) Manage flow
- Move: `_run_manage`, writing `manage.csv`, `degiro_actions.md`
- To: `ui/flows/manage.py` or `src/swing_screener/portfolio/workflow.py`
- Exports: `run_manage(settings) -> updates_df, md_text`

4) Backtest flow
- Move: `_run_backtest`, `_build_bt_config_from_settings`, `_run_quick_backtest_single`
- To: `ui/flows/backtest.py` and `ui/flows/quick_backtest.py`
- Exports: `run_backtest_portfolio(settings)`, `run_quick_backtest(ticker, cfg, start, end)`

5) Candidates tab UI
- Move: action badge render, guidance table, quick add, quick backtest
- To: `ui/components/candidates.py`
- Exports: `render_candidates(report, settings, positions, orders)`

6) Orders tab UI + logic
- Move: order creation, pending update, fill/scale-in UI
- To: `ui/components/orders.py`
- Service layer: `src/swing_screener/execution/orders_service.py`

7) Manage positions UI
- Move: manage tab layout + results formatting
- To: `ui/components/manage.py`

8) Rendering helpers
- Move: `_badge_html`, `_metric`, formatting helpers
- To: `ui/render.py`

## Suggested sequence
1. Extract settings + sidebar (low risk).
2. Extract quick backtest flow (small, isolated).
3. Extract candidates tab UI.
4. Extract manage flow + tab UI.
5. Extract orders tab UI + service layer.
6. Extract backtest panel flow + UI.

## Notes
- Keep behavior unchanged; move code only.
- Add tests if business logic changes.
- Update imports in `ui/app.py` as modules are extracted.
