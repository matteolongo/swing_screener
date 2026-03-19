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
- Frontend tests that assert user-facing copy must source expected text from the i18n module (`web-ui/src/i18n/*`) or the same translation keys used by the UI. Do not duplicate hardcoded visible copy in tests.
- New user-facing flows must add i18n keys and avoid inline fallback strings.
- Configurable behavior must not be hardcoded in source. Route defaults and operator-tunable settings through the existing YAML config surfaces: `config/defaults.yaml`, `config/user.yaml`, `config/strategies.yaml`, `config/intelligence.yaml`, and `config/mcp.yaml`.
- Use `docker-compose.yml` for local service/runtime orchestration only, not as a substitute for app/user/strategy configuration.
- Secrets belong in environment variables, not committed YAML files.
- Cross-layer contract changes must update API models and corresponding Web UI types in the same change.
- Prefer clarity over cleverness

## Testing
- Update tests when behavior changes.
- Keep behavior deterministic.
- Behavior changes require deterministic automated tests in the touched layer(s).
- When adding or updating frontend tests that exercise user-facing copy, assert through i18n-backed text instead of introducing new hardcoded UI strings in test expectations.
- Before committing code changes, run the full test suite for the repository, not only targeted tests for the touched area.

## Docs
- Keep module docs close to code.
- Every completed task must include a documentation check before handoff.
- When changing code in a module/submodule, verify the nearest `README.md` and update it for behavior/contract changes.
- Config, workflow, UX copy, and onboarding changes must update the corresponding documentation in the same change.
- Schema changes in persisted `data/*.json` strategy/config contracts require migration/backfill notes in the nearest `README.md`.
- Update `docs/overview/INDEX.md` when adding/removing docs.

## Delivery
- When finishing branch-based work, provide a GitHub compare link that opens PR creation: `https://github.com/matteolongo/swing_screener/compare/<base>...<head>?expand=1`.
- Use the previous branch in the branch stack, or the branch the work was created from, as `<base>` instead of defaulting to `main`.
- If the intended base branch is uncertain, state the assumed base branch explicitly in the final handoff.
