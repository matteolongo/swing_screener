# Daily Usage Guide

> Status: needs review for your locale and broker.  
> Last reviewed: 2026-06-07.

## Purpose
Use Swing Screener to prepare next-day trades from end-of-day data. The system is a decision aid, not a trading bot.

## Primary Workflow (Web UI)
1. Start backend and web UI.
2. Open **Daily review** and check market-data coverage, portfolio risk, and items that need attention.
3. To change the daily universe, run a scan in **Scan & universes** and pin it for Daily review.
4. Open a candidate to see its next step. Expand its plan, chart, or evidence for more detail.
5. Review eligible orders and record the decision in **Trading book**.
6. Execute at your broker manually, then record fills in **Trading book**.
7. Review positions and update stops according to the plan.

Reference: `../../web-ui/docs/WEB_UI_GUIDE.md`.

## Optional Workflow (CLI)
Use the CLI only for automation or headless usage. Run after market close and generate a report for review. Keep the same rules as the Web UI workflow.

## Timing Rule
Run the screener after the relevant market close so daily candles are final and signals are stable. A result marked `intraday` was computed before every relevant market closed and is a non-final preview; `final_close` identifies the end-of-day result to use for the workflow.

## Current-Price Previews
The application may use a live or user-supplied price to preview position metrics or stop rules. These previews are read-only decision aids: they do not update a persisted stop, place an order, or replace the post-close review. Apply any accepted action manually through the normal workflow.

## Protective Orders After an Exit

Book Orders lists local protective stops and targets separately from entry
plans, with their linked position IDs. After recording a scale-out, verify that
the local protective quantity follows the remaining shares and manually adjust
the matching broker order. After recording a final exit, local active protection
is cancelled; manually cancel the matching broker orders too. The success
reminder identifies the changed local records. Cancelled and filled records
remain available in the corresponding order-history filters.

## Non-Negotiables
- Base final screening and trade decisions on closed end-of-day data.
- Do not move stops lower.
- Do not add size impulsively.
- If there are no signals, do nothing.

## Mental Model
Swing Screener prepares tomorrow's decisions using today's closed data.
