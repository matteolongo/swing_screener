# Daily Usage Guide

> Status: needs review for your locale and broker.  
> Last reviewed: 2026-06-07.

## Purpose
Use Swing Screener to prepare next-day trades from end-of-day data. The system is a decision aid, not a trading bot.

## Primary Workflow (Web UI)
1. Start backend and web UI.
2. Open the Dashboard and review portfolio summary.
3. Run the Screener for your universe.
4. Create orders for candidates you accept.
5. Review risk and submit orders.
6. Next trading day: execute at your broker, then mark fills in the UI.
7. Manage positions and update stops per the plan.

Reference: `../../web-ui/docs/WEB_UI_GUIDE.md`.

## Optional Workflow (CLI)
Use the CLI only for automation or headless usage. Run after market close and generate a report for review. Keep the same rules as the Web UI workflow.

## Timing Rule
Run the screener after the relevant market close so daily candles are final and signals are stable. A result marked `intraday` was computed before every relevant market closed and is a non-final preview; `final_close` identifies the end-of-day result to use for the workflow.

## Current-Price Previews
The application may use a live or user-supplied price to preview position metrics or stop rules. These previews are read-only decision aids: they do not update a persisted stop, place an order, or replace the post-close review. Apply any accepted action manually through the normal workflow.

## Non-Negotiables
- Base final screening and trade decisions on closed end-of-day data.
- Do not move stops lower.
- Do not add size impulsively.
- If there are no signals, do nothing.

## Mental Model
Swing Screener prepares tomorrow's decisions using today's closed data.
