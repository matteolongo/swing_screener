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
- Frontend copy: use the i18n module (`web-ui/src/i18n/*`), avoid hardcoded user-facing strings.
- New user-facing flows must add i18n keys and avoid inline fallback strings.
- Cross-layer contract changes must update API models and corresponding Web UI types in the same change.
- Prefer clarity over cleverness

## Testing
- Update tests when behavior changes.
- Keep behavior deterministic.
- Behavior changes require deterministic automated tests in the touched layer(s).

## Docs
- Keep module docs close to code.
- When changing code in a module/submodule, verify the nearest `README.md` and update it for behavior/contract changes.
- Schema changes in persisted `data/*.json` strategy/config contracts require migration/backfill notes in the nearest `README.md`.
- Update `docs/overview/INDEX.md` when adding/removing docs.
