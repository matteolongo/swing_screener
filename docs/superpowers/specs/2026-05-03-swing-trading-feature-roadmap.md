# Swing Screener — Feature Roadmap
**Audience:** Product Designer · UX/UI Designer · Developer  
**Principle:** Each PR ships standalone value. No feature requires the next to be useful.  
**Ordered by:** Impact on trading outcome × implementation cost

---

## How to read this

Each feature has three sections:
- **What it is** — the trading problem being solved
- **Design brief** — what the designer and UX designer need to produce
- **Dev scope** — what the developer builds

Features are grouped into tiers. Ship all of Tier 1 before starting Tier 2.

---

## Implementation status - 2026-05-04

Tier 1 is being shipped as sequential stacked PRs:

| # | Feature | Branch | Base | PR | Status |
|---|---|---|---|---|---|
| 1 | Trade tagging | `codex/trade-tagging` | `main` | https://github.com/matteolongo/swing_screener/pull/232 | Draft, implemented |
| 2 | Performance breakdown | `codex/edge-breakdown` | `codex/trade-tagging` | https://github.com/matteolongo/swing_screener/pull/233 | Draft, implemented |
| 3 | Account equity auto-update | `codex/account-equity` | `codex/edge-breakdown` | https://github.com/matteolongo/swing_screener/pull/234 | Draft, implemented |
| 4 | Earnings warning | `codex/earnings-warning` | `codex/account-equity` | https://github.com/matteolongo/swing_screener/pull/235 | Draft, implemented |
| 5 | Concentration warning | `codex/concentration-warning` | `codex/earnings-warning` | https://github.com/matteolongo/swing_screener/pull/236 | Draft, implemented |
| 6 | Time stop nudge | `codex/time-stop-nudge` | `codex/concentration-warning` | pending | Implemented locally |

Review stacked PRs in order and compare each PR against its listed base branch.

---

## Tier 1 — Core feedback loop and risk hygiene
*These features have the highest ratio of trading value to build effort. They make the existing workflow meaningfully safer and smarter.*

---

### 1. Structured trade tagging (Journal)

**What it is**  
Right now journal entries are free-text notes. There is no way to filter "did VKP_ON_PULLBACK setups work better than BUY_NOW setups?" or "do I lose more often in choppy markets?". This feature adds structured, queryable tags to every trade close so the user can learn from their own history.

**Design brief**  
- When closing a position, show a lightweight tagging step (not a full form — a few toggle chips).
- Tags fall into three groups: **Setup type** (breakout, pullback, add-on), **Exit reason** (stop hit, time stop, target reached, manual), **Market condition** (trending, choppy, news-driven).
- Tags are optional but nudged — the UI suggests the most likely values based on signal type and how the position was closed.
- Tags are visible on the trade row in Journal view and filterable.
- No free-text replacement — tags complement existing notes field.

**Dev scope**  
- Add `tags: string[]` field to Position model (nullable, defaults to empty).
- Extend close position modal with tag chips.
- Journal table: tag filter chips above the table, filter client-side.
- No backend query needed — tag filtering is frontend-only given small dataset.

---

### 2. Performance breakdown by setup type

**What it is**  
The single most valuable feedback the app can give: "your BUY_ON_PULLBACK trades average +1.8R, your BUY_NOW trades average -0.2R." This tells the user where their edge actually is and lets them ignore low-performing signal types.

**Depends on:** Feature 1 (tags must exist to break down by setup type). Build immediately after.

**Design brief**  
- New section in the Performance tab: "Edge by Setup Type" — a simple table or bar chart per tag group.
- Columns: Setup type · Trades taken · Win rate · Average R · Expectancy (avg R × win rate).
- A second breakdown by Market Condition (from the condition tag).
- No complex filters needed at launch — show all-time stats. Date filter is a V2 addition.
- Empty state: "Close and tag 5+ trades to see your edge breakdown."

**Dev scope**  
- Compute stats client-side from closed positions filtered by tag.
- Expectancy = (win rate × avg winner R) − (loss rate × avg loser R).
- No new API endpoints — positions already returned by existing endpoint.

---

### 3. Account equity auto-update

**What it is**  
Account size drives every position size calculation. Currently it is a static number set once in Settings. As the account grows or shrinks from closed trades, the risk-per-trade calculation becomes stale. A trader who started with €800 and has closed €200 in profits is now risking 2% of €800 instead of 2% of €1000.

**Design brief**  
- Settings page: account size field shows "Base: €800 · Realized P&L: +€200 · Current equity: €1000". 
- User can choose: "Use base amount" or "Use current equity" (toggle, default: current equity).
- On the portfolio summary header, show which mode is active with a small label.
- No dashboard clutter — the change is contained to Settings and the header tooltip.

**Dev scope**  
- Compute realized P&L from closed positions (sum of `(exit_price - entry_price) * shares - fees`).
- Expose as a field on the portfolio summary endpoint.
- Add `account_size_mode: "base" | "equity"` to config.
- Screener and position sizing use effective account size when computing R.

---

### 4. Earnings proximity warning

**What it is**  
Entering a swing trade 3–5 days before an earnings announcement is a known trap — the stock often gaps unpredictably regardless of the technical setup. The app currently has no awareness of upcoming earnings.

**Design brief**  
- On the trade plan panel (when a candidate is selected), show a banner if the next earnings date is within 10 calendar days: "⚠ Earnings in N days — gap risk is elevated."
- If earnings date is unknown, show nothing (don't show "no earnings found" — too much noise).
- The banner is informational, not blocking. User can still create the order.
- Same warning shown in the order creation modal if the user creates an order for that ticker.

**Dev scope**  
- Fetch earnings dates from a free source (Yahoo Finance via yfinance, already available in the stack).
- Cache per ticker per day — one fetch per ticker per session maximum.
- No storage needed — ephemeral, fetched fresh each screener run.
- Fall back silently if fetch fails — the feature degrades gracefully to "no warning."

---

### 5. Portfolio concentration warning

**What it is**  
Three positions in Dutch mid-caps is not three independent R-multiples. It is one bet on the AEX with three position tickets. The app currently shows no sector or country concentration, so the user can unknowingly stack correlated exposure.

**Design brief**  
- Portfolio summary: add a "Concentration" row below the existing heat metric.
- Show the top concentration: "3 positions in NL equities (67% of open risk)".
- If concentration in any single country or sector exceeds 50% of open risk, the label turns amber.
- Clicking the label opens a simple breakdown: by country, by sector (if available).
- At order creation: if the new order would push concentration above 60%, show a soft warning before confirming.

**Dev scope**  
- Derive country from ticker suffix (.AS = NL, .PA = FR, .DE = DE, no suffix = US).
- Sector requires fundamentals data (already partially in stack) — use if available, else group by country only.
- Concentration % = sum of `initial_risk` for positions in that group / total open risk.
- Warning threshold is configurable (default 50%, stored in config).

---

### 6. Time stop nudge

**What it is**  
A position that has been open 15 days and is still at 0.3R is dead capital. Swing trades that don't move within 2–3 weeks are usually wrong or early. Currently the app has no concept of position age relative to progress.

**Design brief**  
- In the daily review and on the position row in Book: if a position has been open more than N days (default 15) and current R < 0.5, show a small amber badge: "15d · 0.3R — consider time stop."
- This is a nudge, not a required action. No modal, no blocking — just visual prominence.
- N days is configurable in strategy settings alongside the existing manage rules.
- The badge disappears once R crosses 0.5 or the position is closed.

**Dev scope**  
- Compute `days_open = today - entry_date` and attach to position metrics.
- Add `time_stop_days` to ManageConfig (default 15) and `time_stop_min_r` (default 0.5).
- Surface `time_stop_warning: bool` in the position metrics response.
- Frontend: amber badge on position rows and daily review manage section.

---

## Tier 2 — Execution quality and signal refinement
*These features improve the quality of entries and the realism of risk calculations. Build once Tier 1 is live and generating feedback.*

---

### 7. Watchlist pipeline view

**What it is**  
The watchlist is currently a static list. A trader who is watching 20 names has to click each one daily to check if it is close to triggering. This feature adds a "distance to trigger" column so the user can see at a glance which watchlist names are warming up.

**Design brief**  
- Watchlist table gets a new column: "Distance to trigger" — how far the current price is from the screener's entry zone for that name (e.g., "−2.1% to buy zone").
- Names sorted by distance ascending — closest to trigger at top.
- A small sparkline (last 5 days close) next to each name for visual context.
- Daily review: a new section "Watchlist nearing trigger — 2 names within 3%" surfaced above candidates.

**Dev scope**  
- Compute distance as `(current_price - signal_trigger_price) / signal_trigger_price * 100`.
- Signal trigger price = the high of the base / consolidation zone (already computable from existing screener logic).
- Attach live price fetch to watchlist load (same mechanism as positions).
- No new data sources required.

---

### 8. Volume quality signal

**What it is**  
A breakout on volume 2× the 20-day average has historically much higher follow-through than a breakout on 0.8× average volume. The screener scores don't currently weight volume at the entry bar.

**Design brief**  
- On the trade plan panel for each candidate, add a volume quality indicator: "Volume: 1.8× avg (strong)" / "Volume: 0.7× avg (weak)".
- Weak volume (< 0.9× avg) adds a caution note: "Low-volume breakout — higher failure rate."
- The screener list can optionally show a volume quality dot (green/amber/red) next to the signal tag.
- No change to the score itself at launch — this is surfaced as context, not a filter.

**Dev scope**  
- Add `volume_ratio: float` (today's volume / 20-day avg volume) to screener candidate output.
- Already have OHLCV data — pure calculation, no new data source.
- Frontend: volume ratio displayed in trade plan, dot in screener list.

---

### 9. Liquidity filter

**What it is**  
A technically perfect setup in a stock that trades €40,000/day average volume cannot be entered at meaningful size without moving the market. The screener currently has no minimum liquidity check.

**Design brief**  
- In Settings: "Minimum average daily volume" field (default: €100k notional / day).
- Candidates that fail the liquidity threshold are either hidden from results or shown with a "Low liquidity" warning tag.
- User can toggle the filter off to see all candidates.
- At order creation: if the position size exceeds 5% of avg daily volume, show a warning: "Order size is X% of avg daily volume — expect slippage."

**Dev scope**  
- Add `avg_daily_volume_eur` to screener candidate (price × avg volume).
- Add `min_liquidity_eur` to strategy config (default 100,000).
- Filter applied in screener pipeline before ranking.
- Position size vs daily volume check at order creation endpoint.

---

### 10. Partial exit workflow

**What it is**  
The system currently models positions as all-in / all-out. Many swing traders reduce size at 1R (locking in profit, reducing risk) and let the remainder run. This changes both the risk profile and the psychological experience of a trade.

**Design brief**  
- On an open position, add a "Partial close" action alongside the existing "Close" button.
- Modal: "Close how many shares?" (pre-filled to 50%), shows resulting locked profit and remaining risk.
- After partial close: position shows "9 shares → 4 remaining" with updated stop and adjusted R metrics.
- Journal records the partial close as a separate event with its own R at that point.
- Full close later records the final leg.

**Dev scope**  
- Partial close creates a new `partial_close` event on the position: `{ date, shares_closed, price, r_at_close }`.
- Position `shares` reduced, `initial_risk` preserved (for R calculation continuity).
- Metrics endpoint computes blended R across partial and final exits.
- No new position record created — partial closes live as events on the parent position.

---

## Tier 3 — Advanced analytics and refinement
*Build only after Tier 1 and Tier 2 are live and the user has enough data to make these meaningful.*

---

### 11. Regime-conditional performance

**What it is**  
"Should I be trading aggressively right now or staying small?" depends on whether the broad market regime favors swing trading. This feature shows the user their own win rate and average R broken down by market regime, so they can calibrate position sizing to conditions.

**Design brief**  
- Performance tab: a "By market regime" section showing the same stats as Feature 2 (win rate, avg R, expectancy) but segmented by regime at trade entry date.
- Regimes: Trending up · Trending down · Choppy/range.
- Regime at any date is derivable from the existing regime detection logic applied to a benchmark (e.g., SPY or AEX).
- Simple table, no chart needed at launch.

**Dev scope**  
- Backfill regime label for each closed position's entry date using the existing regime evaluator.
- Group and aggregate closed positions by regime.
- Expose as a new analytics endpoint or computed client-side from enriched position data.

---

### 12. Currency-adjusted R display

**What it is**  
A position in SBMO.AS denominated in EUR, tracked in a USD-based account, has FX risk between entry and exit. The current R calculation ignores this. A trade that shows +2R in EUR might be +1.4R in USD after FX movement.

**Design brief**  
- On position metrics: if the position currency differs from the base account currency, show both R values: "R now: +1.8 (EUR) · +1.4 (USD)".
- A small info tooltip explains the difference.
- No change to stop management logic — FX-adjusted R is display-only at this stage.

**Dev scope**  
- Fetch daily FX rate for EUR/USD (or relevant pairs) — one rate per day, cached.
- Add `r_fx_adjusted: float | null` to position metrics (null when currencies match).
- Frontend: secondary R display in position detail.

---

### 13. Trail customization per position

**What it is**  
The current SMA20 trail is a reasonable default but different setups call for different trail logic. A tight consolidation breakout warrants a tighter trail (ATR-based); a wide momentum name warrants more room.

**Design brief**  
- On each open position: a "Trail method" selector in the manage section.
- Options: SMA20 (default) · ATR multiple · Fixed % · Manual only.
- Selecting an option recalculates the current stop suggestion live in the UI.
- The selected trail method persists on the position and is used in daily review suggestions.

**Dev scope**  
- Add `trail_method: "sma20" | "atr" | "fixed_pct" | "manual"` and `trail_param: float | null` to Position.
- Stop suggestion logic branches on trail_method.
- ATR trail: stop = current_price − (ATR × param), param default 2.0.
- Fixed %: stop = current_price × (1 − param / 100).

---

### 14. Multi-timeframe trend filter

**What it is**  
The screener works on daily bars. A daily breakout that contradicts the weekly trend has lower follow-through. Adding a weekly trend check as a filter (not a score adjustment) would reduce false signals.

**Design brief**  
- Screener candidate detail: show weekly trend status — "Weekly: Uptrend ✓" or "Weekly: Downtrend ✗".
- A filter toggle in the screener: "Require weekly uptrend" (default off — user enables when they want stricter filtering).
- No change to the score — weekly trend is a hard filter or an informational overlay, user's choice.

**Dev scope**  
- Compute weekly SMA20 and SMA50 from existing OHLCV data (resample daily to weekly).
- Weekly uptrend: close > weekly SMA20 > weekly SMA50.
- Add `weekly_trend: "up" | "down" | "neutral"` to screener candidate output.
- Filter applied in pipeline when strategy config `require_weekly_uptrend: true`.

---

## Implementation order summary

Last updated: 2026-05-04

| # | Feature | Tier | Status | Value delivered |
|---|---------|------|--------|----------------|
| 1 | Trade tagging | 1 | ✅ Done — `codex/trade-tagging` / PR #232 | Queryable journal |
| 2 | Performance by setup | 1 | ✅ Done — `codex/edge-breakdown` / PR #233 | See your edge |
| 3 | Account equity auto-update | 1 | ✅ Done — `codex/account-equity` / PR #234 | Accurate sizing |
| 4 | Earnings warning | 1 | ✅ Done — `codex/earnings-warning` / PR #235 | Avoid earnings traps |
| 5 | Concentration warning | 1 | ✅ Done — `codex/concentration-warning` / PR #236 | Prevent correlated bets |
| 6 | Time stop nudge | 1 | ✅ Done — `codex/time-stop-nudge` / PR pending | Kill dead capital |
| 7 | Watchlist pipeline | 2 | 🔲 No plan yet | Spot setups early |
| 8 | Volume quality | 2 | 🔲 No plan yet | Better entry timing |
| 9 | Liquidity filter | 2 | 🔲 No plan yet | Avoid illiquid names |
| 10 | Partial exits | 2 | 🔲 No plan yet | Scale-out capability |
| 11 | Regime performance | 3 | 🔲 No plan yet | Size to conditions |
| 12 | FX-adjusted R | 3 | 🔲 No plan yet | True R visibility |
| 13 | Trail customization | 3 | 🔲 No plan yet | Setup-specific trails |
| 14 | MTF trend filter | 3 | 🔲 No plan yet | Fewer false signals |
