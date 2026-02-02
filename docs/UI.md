# Swing Screener UI

This is a local-first Streamlit UI that wraps the existing screener and position manager logic.
It does not place trades or connect to brokers.

## Requirements

- Python 3.11+
- Repo installed in editable mode

## Install

```
pip install -e .
```

## Run

```
streamlit run ui/app.py
```

## Pages

### Daily Screener

- Select a universe, optional Top N cap, account size, and risk %.
- Run the screener to generate the daily report.
- The report is saved to `out/report.csv` by default and can be downloaded.
- The candidates table includes a `confidence` score (0-100) for active signals only.
- Use **Create pending orders** to open an inline form per row, edit the values, and save the order.
- Pending-order cards include Degiro-style entry and stop-loss details (limit/stop prices and bands when available).

### Action Badges

The Daily Screener includes action badges that summarize the next-day execution hint:
- 🟢 PLACE BUY LIMIT — suggested limit entry
- 🔵 PLACE BUY STOP — suggested stop entry
- ⚪ SKIP TRADE — no trade to place
- 🟡 INCOMPLETE DATA — required fields missing

Badges are visual guidance only and do not execute orders.

### Manage Positions

- Loads `./positions.json` by default.
- Edit open positions in the table (ticker, entry, stop, shares).
- Click **Manage** to generate stop suggestions and a Degiro checklist.
- If **Apply stop updates** is enabled, stops are updated in `positions.json` (never lowered).

### Orders

- Loads `./orders.json` by default.
- Add pending entry orders (ticker, limit/stop, quantity, stop).
- Stop price is optional for pending orders; it is required when marking an order as filled.
- Review pending orders and mark them **filled** or **cancelled**.
- When marked **filled**, a position is created in `positions.json` with a `position_id` linked to the entry order.
- A linked **stop-loss order** (GTC) is created automatically.
- An optional **take-profit order** (GTC) is created if you provide a TP price.

### Outputs

- Preview `out/report.csv` and `out/degiro_actions.md` if present.
- Shows the last run timestamp.

## Daily routine (one click)

Use **Run Daily Routine** in the sidebar to:

1. Run the screener with current settings.
2. Run position management.
3. Save outputs and show the Outputs page.

## Notes

- Data is fetched via the existing Yahoo Finance loader.
- All logic stays deterministic and uses the same core modules as the CLI.
- The UI can load built-in universes or a user-provided CSV (one ticker per line). Filters (include/exclude/grep, ensure benchmark) mirror the CLI. Use the sidebar to point to your CSV if you curate universes via `swing-screener universes filter ...`.
