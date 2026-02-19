# Swing Screener — Operational Guide (CLI)

> **Status: Current.**  
> **Last Reviewed:** February 17, 2026.

## Purpose
Minimal CLI workflow reference for headless or scripted usage.

## Core Commands
- Start API: `python -m uvicorn api.main:app --port 8000 --reload`
- Run screener (CLI): `python -m swing_screener.cli run --universe sp500`
- List positions (CLI): `python -m swing_screener.cli positions list`
- Update stops (CLI): `python -m swing_screener.cli positions update-stops`

## Notes
- Web UI is recommended for daily use.
- See `docs/product/DAILY_USAGE_GUIDE.md` for timing guidance.
