# Backend Correctness Backlog

> Status snapshot for the backend/API correctness audit.
> Scope excludes UI work. Main concern: contracts, calculations, processing logic, and data truthfulness.

## Completed

1. Portfolio summary account-currency contract
   - Status: done.
   - Outcome: open-position aggregate money fields now report in account currency for USD/EUR positions.
   - Verification: `tests/api/test_portfolio_summary_currency.py` plus portfolio summary/concentration regressions.

2. Realized P&L, fees, partial closes, and execution FX
   - Status: done.
   - Outcome: realized P&L deducts entry fees once, allocates entry fees pro-rata across partial/final closes, deducts exit fees, and supports optional execution EURUSD rates on partial/final exits.
   - Verification: `tests/api/test_portfolio_realized_pnl_accounting.py` plus portfolio fee/equity regressions.

3. Screener/risk currency contract
   - Status: done.
   - Outcome: screener candidates now expose canonical quote/account currency metadata for position value and risk fields while preserving legacy USD-named fields for compatibility.
   - Verification: `tests/api/test_screener_currency_contract.py` plus screener/risk/same-symbol regressions.

4. Risk sizing FX contract
   - Status: done.
   - Outcome: pure risk sizing and recommendation logic now accept an explicit account-to-quote FX rate, convert account-currency budgets into quote-currency share sizing, and report account-currency realized risk/position value alongside legacy quote-currency fields.
   - Verification: `tests/test_position_sizing.py`, `tests/test_recommendation_engine.py`, and `tests/test_risk_engine.py`.

5. Screener FX rate wiring
   - Status: done.
   - Outcome: screener runs source EURUSD when known/requested quote currencies cross EUR/USD, pass account-to-quote rates into report trade-plan sizing, and preserve account-currency risk through recommendation rebuilds.
   - Verification: `tests/test_report.py`, `tests/test_screener_service.py`, and `tests/api/test_screener_currency_contract.py`.

6. Liquidity filter correctness
   - Status: done.
   - Outcome: average daily volume liquidity thresholds now use EUR-denominated turnover, USD quotes require an explicit USD-to-EUR rate, the liquidity field is available before universe filtering, and active liquidity thresholds fail closed when liquidity cannot be computed.
   - Verification: `tests/test_setup_quality.py`, `tests/test_universe_filter.py`, `tests/test_report.py`, and `tests/test_screener_service.py`.

7. Stop-hit detection uses daily low
   - Status: done.
   - Outcome: live portfolio management and event-study backtests now trigger stop-hit exits when the latest daily low crosses the stop, even if the close recovers above it.
   - Verification: `tests/test_portfolio_manage.py`, `tests/test_backtest_event_study.py`, and `tests/api/test_backtest_endpoints.py`.

## Next

8. Holding period semantics
   - Decide and enforce calendar-day vs trading-day semantics for holding-period exits.

## Backlog

9. Screener fallback stop uses strategy ATR multiplier
   - Ensure fallback stop generation respects configured `k_atr`.

10. Reject invalid or negative stops
   - Enforce long-position stop invariants across API, screener, and order flows.

11. Provider interval/end-date contract
   - Ensure market-data requests produce the intended final bar and do not silently omit the requested date.

12. Align OHLCV in setup quality
   - Ensure setup-quality indicators calculate on aligned OHLCV bars.

13. Missing SMA fields stay missing
   - Avoid fabricating technical values when source data is insufficient.

14. Unknown currency policy
   - Define and enforce behavior for tickers whose quote currency cannot be detected.

15. Finite float coercion
   - Prevent NaN/Inf from entering API responses and persisted calculations.

16. Intelligence position fallback
   - Ensure intelligence flows do not silently substitute stale or incorrect position context.

17. Intelligence cache locking
   - Protect intelligence cache writes from concurrent corruption.

18. `total_screened` semantics
   - Clarify whether it means input universe size, fetched rows, candidates after filters, or displayed rows.

19. Finnhub integration reliability
   - Make external Finnhub integration tests deterministic or gracefully skipped when vendor data is missing.
