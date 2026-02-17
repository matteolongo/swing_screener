# AGENTS.md — Swing Screener

Project scope, constraints, and conventions for code changes.

## Scope
- End-of-day swing-trading workflows
- Manual execution
- Deterministic, testable logic

## Non-goals
- Live trading / broker execution
- Intraday logic
- ML or curve-fitting
- Hidden state or heuristic tuning

## Core Concepts
- OHLCV data uses a MultiIndex DataFrame (field, ticker).
- Risk is expressed in R-multiples: `1R = entry - stop`.
- Position sizing and risk rules are first-class.

## Repo Layout
- `api/`: FastAPI service
- `src/swing_screener/`: core library
- `web-ui/`: React frontend
- `data/`: runtime JSON data
- `docs/`: documentation

## Conventions
- Backend: snake_case, explicit types
- Frontend: camelCase, transform at API boundary
- Prefer clarity over cleverness

## Testing
- Update tests when behavior changes.
- Keep behavior deterministic.

## Docs
- Keep module docs close to code.
- Update `docs/overview/INDEX.md` when adding/removing docs.
