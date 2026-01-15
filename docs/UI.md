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
