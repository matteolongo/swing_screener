# AGENTS.md

This file provides contributor instructions for every coding agent working in
this repository.

## What This Is

**Swing Screener** is a deterministic, risk-first swing-trading framework for end-of-day US equity workflows. It screens stock universes post-market-close, sizes positions using R-multiples, and keeps all execution manual.

**Non-goals (never add):** live trading/broker APIs, intraday logic, ML/curve-fitting, auto-execution of positions, hidden state or heuristic magic.

## Where things live (read the doc before grepping)

These docs are the index to this repo. **Locate your area here and read that doc first** — it lists the public API, files, and config keys for the area. Open source code only to confirm the exact lines you will edit; do not sweep the tree to rediscover structure the docs already record. They are kept current by the "Documentation Rules" checklist below (enforced on every change), so trust them as the map.

Start with [`docs/overview/INDEX.md`](docs/overview/INDEX.md) — the full doc catalog. Fast paths:

| Working on… | Read first |
|---|---|
| A REST endpoint (request/response shapes) | [`api/README.md`](api/README.md) |
| A React page or feature | [`web-ui/docs/WEB_UI_GUIDE.md`](web-ui/docs/WEB_UI_GUIDE.md) |
| Web UI structure / API contract / state rules | [`web-ui/docs/WEB_UI_ARCHITECTURE.md`](web-ui/docs/WEB_UI_ARCHITECTURE.md) |
| Any config key | [`config/README.md`](config/README.md) |
| Runtime state schema (positions, orders) | [`data/README.md`](data/README.md) |
| The LLM / intelligence pipeline | [`src/swing_screener/intelligence/README.md`](src/swing_screener/intelligence/README.md) |
| Position sizing / R-multiple risk logic | [`src/swing_screener/risk/README.md`](src/swing_screener/risk/README.md) |
| Universe filtering, ranking, entry signals | [`src/swing_screener/selection/README.md`](src/swing_screener/selection/README.md) |
| A strategy plugin | [`src/swing_screener/strategy/README.md`](src/swing_screener/strategy/README.md) |
| Position / portfolio metrics | [`src/swing_screener/portfolio/README.md`](src/swing_screener/portfolio/README.md) |
| Order lifecycle / DeGiro fees | [`src/swing_screener/execution/README.md`](src/swing_screener/execution/README.md) |
| OHLCV data, caching, providers | [`src/swing_screener/data/README.md`](src/swing_screener/data/README.md) + [`providers/README.md`](src/swing_screener/data/providers/README.md) |
| Indicators (trend/momentum/volatility) | [`src/swing_screener/indicators/README.md`](src/swing_screener/indicators/README.md) |
| Daily report / CSV / today_actions | [`src/swing_screener/reporting/README.md`](src/swing_screener/reporting/README.md) |
| Backtesting | [`src/swing_screener/backtest/README.md`](src/swing_screener/backtest/README.md) |
| Fundamentals providers | [`src/swing_screener/fundamentals/providers/README.md`](src/swing_screener/fundamentals/providers/README.md) |
| Canonical module layout / design rules | [`docs/engineering/MODULE_ARCHITECTURE.md`](docs/engineering/MODULE_ARCHITECTURE.md) |

If a doc contradicts the code, the code is right — fix the doc as part of your change (see "Documentation Rules").

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

## Versioning and releases

Swing Screener follows [Semantic Versioning](https://semver.org/). Use the
smallest compatible bump that describes the release:

- **Patch** (`X.Y.Z+1`) for backwards-compatible fixes, security fixes, and
  documentation corrections.
- **Minor** (`X.Y+1.0`) for backwards-compatible features, endpoints, config,
  and workflow additions.
- **Major** (`X+1.0.0`) for incompatible API, persisted-data, config, or
  operational changes that require a consumer action or migration.

`pyproject.toml` is the canonical application version. `web-ui/package.json`
and both root version fields in `web-ui/package-lock.json` are required release
mirrors. The FastAPI/OpenAPI version must use `swing_screener.version.get_version()`;
do not add a second literal version there.

Record unreleased user-facing changes in [`CHANGELOG.md`](CHANGELOG.md) under
`Unreleased`. At release time, move them into `## [X.Y.Z] - YYYY-MM-DD` and
synchronize all metadata. Before every release commit, run:

```bash
python scripts/check_release_version.py
```

Use the commit title `Release vX.Y.Z`. After the release PR is merged, create
an annotated tag named `vX.Y.Z`, then create the GitHub release from the matching
changelog section. Do not create a release tag for an unmerged PR.

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
8. **Notebooks** — if you changed a module's public API (function signature, config key, return type, class name), update the corresponding notebook in `notebooks/`. Run the notebook end-to-end before committing.

When in doubt: read the relevant doc, check if it still describes what the code does, and update any section that no longer matches.

## Documenting a module

When asked to document a module or write a module README:

1. Explore the module: read all `.py` files, understand the public API, find all config keys.
2. Check `docs/engineering/MODULE_ARCHITECTURE.md` for the canonical module description.
3. Draft a README covering: purpose, file map, public API surface (function signatures + return types), config keys, known limitations.
4. Update `docs/overview/INDEX.md` to include the new README.

## PR Delivery

### GitHub CLI access

Before a GitHub write, run `gh auth status` and confirm the active account has
the required repository permission. Prefer the GitHub connector for PR metadata
and write actions; use `gh` when the connector lacks the required capability.

### Compare URL format

```
https://github.com/matteolongo/swing_screener/compare/<base>...<head>?expand=1
```

Use the branch the work was created from as `<base>`, not `main`, unless the work branches directly from `main`. If uncertain, state the assumed base explicitly.

### UI screenshots in PR descriptions

When a change affects the Web UI (`web-ui/` pages, components, styling, visible copy, or user flows), capture one or more screenshots that show the changed UI state before delivery. Attach or embed those screenshots in the PR description under a `Screenshots` section so reviewers can verify the visual impact without running the app locally.

If the work is pushed directly to `main` and no GitHub PR will be opened, still include the screenshot links or file references in the delivery note or `prs.md` description. If a screenshot cannot be captured because of an environment limitation, document the exact limitation in the PR description instead of omitting the section.

### prs.md output — required after every implementation

Whenever implementation work is complete (or the user asks to implement something), write a file called `prs.md` to the session scratchpad directory and paste its contents in the response. Format:

```
<compare URL>

<title>

<description>

---

<compare URL for next PR if stacked>

<title>

<description>
```

No narrative around the block — just the file contents. Titles and descriptions follow the `matteo-tone-of-voice` skill (imperative title, freeform prose body, backticks on identifiers, no fluff openers).

### Stacked PRs

When a feature needs more than one branch (refactor that unblocks a feature, large feature split into layers, etc.), generate stacked PRs:

- List them **in merge order**: first PR listed is the first to merge.
- Each PR's `<base>` is the branch directly below it in the stack (only the bottom PR targets `main`).
- Each description references the one below it: "Stack: merge #N first."
- All PRs go in the same `prs.md`, separated by `---`.

## Feature Context

For deeper context on a specific area:
- Backend modules: `docs/engineering/MODULE_ARCHITECTURE.md`
- API surface: `api/README.md`
- Web UI pages and features: `web-ui/docs/WEB_UI_GUIDE.md`
- Intelligence module: `src/swing_screener/intelligence/README.md`
- Config options: `config/README.md`
- Runtime data schema: `data/README.md`
- Roadmap: `docs/engineering/ROADMAP.md`
