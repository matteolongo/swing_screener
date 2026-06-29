# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Swing Screener** is a deterministic, risk-first swing-trading framework for end-of-day US equity workflows. It screens stock universes post-market-close, sizes positions using R-multiples, and keeps all execution manual.

**Non-goals (never add):** live trading/broker APIs, intraday logic, ML/curve-fitting, auto-execution of positions, hidden state or heuristic magic.

## Commands

### Backend (Python)
```bash
# Setup (uv is available; alternatively use venv)
uv sync
# or: python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"

# Tests (run before and after changes)
pytest -q
pytest tests/test_ranking.py -q          # single file
pytest -k "test_position_sizing" -q      # by name pattern
pytest -m "not integration" -q          # skip tests requiring API keys

# Lint / format
ruff check .
black .

# Run API server
python -m uvicorn api.main:app --port 8000 --reload
```

### Frontend (TypeScript)
```bash
cd web-ui && npm install

npm run dev          # dev server (Vite)
npm run build        # production build
npm test             # Vitest (run before and after changes)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint strict, zero warnings allowed
npm run test:coverage
npx vitest run src/features/portfolio  # single directory
npx vitest -t "renders positions"      # by test name
```

### Full test suite before committing
```bash
pytest -q && cd web-ui && npm test
```

## Architecture

### Layer Responsibilities
| Layer | Path | Role |
|-------|------|------|
| Core library | `src/swing_screener/` | Pure trading logic |
| API | `api/routers/` + `api/services/` + `api/repositories/` | FastAPI REST, business logic, JSON/SQLite I/O |
| Web UI | `web-ui/` | React 18 + TypeScript, Zustand, React Query |

See `docs/engineering/MODULE_ARCHITECTURE.md` for the canonical backend module list and `web-ui/docs/WEB_UI_GUIDE.md` for the frontend page and feature map.

## Critical Conventions

### OHLCV Data Format
Market data is always a Pandas DataFrame with:
- index = date
- columns = MultiIndex `(field, ticker)` — e.g. `(Close, AAPL)`, `(Volume, MSFT)`

### R-Multiples (Risk Model)
All risk and position management uses R: `1R = entry_price - stop_price`. Never replace R-based logic with fixed-dollar or percentage-based alternatives.

### snake_case ↔ camelCase at API Boundary
Backend uses `snake_case`, frontend uses `camelCase`. Transform **only** at the API boundary using the existing `transformPosition()`, `transformOrder()`, etc. functions.

### i18n (Frontend)
All user-facing strings go through `web-ui/src/i18n/`. No hardcoded UI strings in components or test assertions — source expected text from the same i18n keys the UI uses.

### Cross-layer Contract Changes
API model changes and corresponding Web UI type changes must be in the **same commit/PR**.

### Schema Changes to `data/*.json`
Require migration/backfill notes in the nearest `README.md`.

### Config Surfaces
Configurable behavior goes in YAML, never hardcoded. Config files live in `config/`. See `config/README.md` for which file to use for each type of setting.

### Runtime State
Primary state: `data/positions.json` (open trades), `data/orders.json` (order lifecycle). See `data/README.md` for schema notes and migration history.

## Intraday Boundary

The system may read a current or user-supplied price to preview position metrics or stop rules.

- Preview endpoints must be read-only: they must not persist a stop change, submit an order, or mutate portfolio state.
- Screener results based on an unclosed daily candle must be labeled `intraday`; only results labeled `final_close` are final end-of-day output.
- Actionable recommendations remain part of the post-close review and require manual broker execution.

## Additional Conventions

- Configurable behavior routes through YAML config (`config/defaults.yaml`, `config/user.yaml`, `config/strategies.yaml`, `config/intelligence.yaml`, `config/mcp.yaml`). Never hardcode operator-tunable settings in source.
- Secrets belong in environment variables, not committed YAML files.
- Use `docker-compose.yml` for local service orchestration only, not as a substitute for app or strategy configuration.

## Testing Patterns

**Backend:** prefer pure functions; keep behavior deterministic; use `pytest`. Tests requiring external API keys must be marked `@pytest.mark.integration` — they are skipped in CI.

**Frontend:**
- Use `renderWithProviders()` for component tests
- Mock APIs with MSW handlers
- Coverage thresholds enforced: 80%+ lines, 75%+ branches
- Assert user-facing copy through i18n-backed text, not hardcoded strings

## Documentation Rules

Before finishing any code change, go through this checklist:

1. **Nearest README** — does the module/layer you touched have a `README.md`? If the behavior, contract, or public interface changed, update it.
2. **Config docs** — if you added or changed a config key, update `config/README.md` and the relevant YAML file's inline comments.
3. **API surface** — if you added, removed, or changed an endpoint signature, update `api/README.md`.
4. **Web UI feature map** — if you added or removed a page or feature directory, update `web-ui/docs/WEB_UI_GUIDE.md`.
5. **Schema changes** — if `data/*.json` schema changed, add migration/backfill notes in the nearest `README.md`.
6. **New doc files** — if you created a new doc, add it to `docs/overview/INDEX.md`.
7. **Intelligence module** — if you changed the analysis pipeline, cache, or API surface, update `src/swing_screener/intelligence/README.md`.

When in doubt: read the relevant doc, check if it still describes what the code does, and update any section that no longer matches.

## Documenting a module

When asked to document a module or write a module README:

1. Explore the module: read all `.py` files, understand the public API, find all config keys.
2. Check `docs/engineering/MODULE_ARCHITECTURE.md` for the canonical module description.
3. Draft a README covering: purpose, file map, public API surface (function signatures + return types), config keys, known limitations.
4. Update `docs/overview/INDEX.md` to include the new README.

## PR Delivery

When finishing branch-based work, provide a GitHub compare link:
```
https://github.com/matteolongo/swing_screener/compare/<base>...<head>?expand=1
```
Use the branch the work was created from as `<base>` (not `main` by default). If uncertain, state the assumed base explicitly.

## Feature Context

For deeper context on a specific area:
- Backend modules: `docs/engineering/MODULE_ARCHITECTURE.md`
- API surface: `api/README.md`
- Web UI pages and features: `web-ui/docs/WEB_UI_GUIDE.md`
- Intelligence module: `src/swing_screener/intelligence/README.md`
- Config options: `config/README.md`
- Runtime data schema: `data/README.md`
- Roadmap: `docs/engineering/ROADMAP.md`
