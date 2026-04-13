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

# CLI
python -m agent.cli screen --universe mega_all --strategy-id default --top 10
python -m agent.cli positions review
python -m agent.cli daily-review
python -m agent.cli chat "What orders are pending?"
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

### Two Runtime Paths
Both converge on the same shared services:
1. **Web UI** → FastAPI (`api/`) → Services → Core library
2. **Agent CLI** (`agent/`) → Services → Core library (same service factories as the API, no HTTP hop)

### Layer Responsibilities
| Layer | Path | Role |
|-------|------|------|
| Core library | `src/swing_screener/` | Pure trading logic |
| API | `api/routers/` + `api/services/` + `api/repositories/` | FastAPI REST, business logic, JSON/SQLite I/O |
| Agent CLI | `agent/cli.py` | argparse CLI, calls service factories directly, includes LangGraph chat loop |
| Web UI | `web-ui/` | React 18 + TypeScript, Zustand, React Query |

### Core Library Modules (`src/swing_screener/`)
- **selection/**: screening pipeline — universe filtering → momentum ranking → entry signals
- **risk/**: position sizing, stop calculation, regime-aware risk scaling
- **portfolio/**: position lifecycle, P&L, R-multiple metrics
- **execution/**: orders, order workflows, entry fills
- **indicators/**: SMA trend, RS/momentum %, ATR volatility
- **intelligence/**: post-close LLM enrichment (LangChain/LangGraph), event ingestion, catalyst scoring
- **strategy/**: strategy config, module/regime plugins
- **recommendation/**: recommendation engine (separate from strategy/)
- **fundamentals/**: fundamental data providers, scoring, snapshot storage
- **social/**: sentiment providers and scoring
- **integrations/**: broker integrations (e.g. DeGiro via `degiro` optional dep)
- **data/**: universe definitions, snapshot registries, market data providers
- **settings/**: YAML config loading, `SettingsManager`, path resolution
- **db.py**: SQLAlchemy ORM models for positions/orders (SQLite); parallel to JSON files

### Configuration Surfaces (YAML — never hardcode configurable behavior)
- `config/defaults.yaml` — system defaults
- `config/user.yaml` — user overrides
- `config/strategies.yaml` — strategy definitions
- `config/intelligence.yaml` — intelligence/LLM config
- `config/mcp.yaml` — MCP tool toggles

### Runtime State (JSON — single source of truth)
- `data/positions.json` — open trades
- `data/orders.json` — order lifecycle state
- `data/config.json` — application config snapshot

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

## Testing Patterns

**Backend:** prefer pure functions; keep behavior deterministic; use `pytest`. Tests requiring external API keys must be marked `@pytest.mark.integration` — they are skipped in CI.

**Frontend:**
- Use `renderWithProviders()` for component tests
- Mock APIs with MSW handlers
- Coverage thresholds enforced: 80%+ lines, 75%+ branches
- Assert user-facing copy through i18n-backed text, not hardcoded strings

## Documentation Rules

- Every behavior/contract change must update the nearest `README.md`.
- Config, workflow, UX, and onboarding changes update corresponding docs in the same change.
- Update `docs/overview/INDEX.md` when adding/removing docs.

## PR Delivery

When finishing branch-based work, provide a GitHub compare link:
```
https://github.com/matteolongo/swing_screener/compare/<base>...<head>?expand=1
```
Use the branch the work was created from as `<base>` (not `main` by default). If uncertain, state the assumed base explicitly.
