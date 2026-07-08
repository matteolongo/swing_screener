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

## Next

4. Risk sizing FX
   - Status: next.
   - Confirm risk engine converts account-currency risk budgets into quote-currency share sizing correctly.

## Backlog

5. Liquidity filter correctness
   - Confirm average daily volume/liquidity thresholds use price and currency consistently.

6. Stop-hit detection uses daily low
   - Confirm stop-hit checks trigger on intraday low crossing the stop, not close-only behavior.

7. Holding period semantics
   - Decide and enforce calendar-day vs trading-day semantics for holding-period exits.

8. Screener fallback stop uses strategy ATR multiplier
   - Ensure fallback stop generation respects configured `k_atr`.

9. Reject invalid or negative stops
   - Enforce long-position stop invariants across API, screener, and order flows.

10. Provider interval/end-date contract
   - Ensure market-data requests produce the intended final bar and do not silently omit the requested date.

11. Align OHLCV in setup quality
   - Ensure setup-quality indicators calculate on aligned OHLCV bars.

12. Missing SMA fields stay missing
   - Avoid fabricating technical values when source data is insufficient.

13. Unknown currency policy
   - Define and enforce behavior for tickers whose quote currency cannot be detected.

14. Finite float coercion
   - Prevent NaN/Inf from entering API responses and persisted calculations.

15. Intelligence position fallback
   - Ensure intelligence flows do not silently substitute stale or incorrect position context.

16. Intelligence cache locking
   - Protect intelligence cache writes from concurrent corruption.

17. `total_screened` semantics
   - Clarify whether it means input universe size, fetched rows, candidates after filters, or displayed rows.

18. Finnhub integration reliability
   - Make external Finnhub integration tests deterministic or gracefully skipped when vendor data is missing.
