# Doc Hub Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CLAUDE.md the fast-load agent entry point by trimming it to a hub with links to feature-specific docs, deleting stale planning docs, and fixing all broken references.

**Architecture:** Pure documentation change — no code, no tests. Each task is a targeted edit or deletion followed by a commit. The branch is `codex/web-ui-dead-code-cleanup`; open a PR against `main` when done.

**Tech Stack:** Markdown, git.

**Spec:** `docs/superpowers/specs/2026-06-01-doc-hub-restructure-design.md`

---

## File Map

**Delete:**
- `docs/engineering/BACKEND_CLEANUP_AUDIT.md`
- `docs/engineering/BACKEND_CLEANUP_ROADMAP.md`
- `docs/engineering/COMBINED_ANALYSIS_IMPLEMENTATION_PLAN.md`
- `docs/engineering/PREDICTIVE_AND_EXPLANATION_IMPROVEMENT_PLAN.md`
- `docs/engineering/predictive-improvement/` (entire folder)
- `docs/engineering/MODULE_ARCHITECTURE_MIGRATION_PLAN.md`
- `docs/engineering/CODE_REVIEW.md`
- `docs/engineering/UNIVERSE_MANAGEMENT_REMEDIATION_PLAN.md`
- `docs/engineering/WORKSPACE_CHAT_ANALYSIS.md`

**Modify:**
- `CLAUDE.md` — trim to hub, add Feature Context section
- `README.md` — remove dead mcp_server refs and WORKSPACE_CHAT_ANALYSIS link
- `config/README.md` — remove dead mcp_server doc links
- `docs/overview/INDEX.md` — remove dead refs, add intelligence README, remove deleted docs
- `.github/copilot-instructions.md` — fix AGENTS.md path, remove dead ref, drop stale test count
- `web-ui/README.md` — update page list
- `web-ui/docs/WEB_UI_GUIDE.md` — full rewrite: current pages + feature map
- `web-ui/docs/WEB_UI_ARCHITECTURE.md` — update structure, last reviewed date

**Create:**
- `src/swing_screener/intelligence/README.md`

---

### Task 1: Delete planning and archived docs

**Files:**
- Delete: `docs/engineering/BACKEND_CLEANUP_AUDIT.md`
- Delete: `docs/engineering/BACKEND_CLEANUP_ROADMAP.md`
- Delete: `docs/engineering/COMBINED_ANALYSIS_IMPLEMENTATION_PLAN.md`
- Delete: `docs/engineering/PREDICTIVE_AND_EXPLANATION_IMPROVEMENT_PLAN.md`
- Delete: `docs/engineering/predictive-improvement/` (entire folder)
- Delete: `docs/engineering/MODULE_ARCHITECTURE_MIGRATION_PLAN.md`
- Delete: `docs/engineering/CODE_REVIEW.md`
- Delete: `docs/engineering/UNIVERSE_MANAGEMENT_REMEDIATION_PLAN.md`
- Delete: `docs/engineering/WORKSPACE_CHAT_ANALYSIS.md`

- [ ] **Step 1: Delete all files**

```bash
git rm docs/engineering/BACKEND_CLEANUP_AUDIT.md \
       docs/engineering/BACKEND_CLEANUP_ROADMAP.md \
       docs/engineering/COMBINED_ANALYSIS_IMPLEMENTATION_PLAN.md \
       docs/engineering/PREDICTIVE_AND_EXPLANATION_IMPROVEMENT_PLAN.md \
       docs/engineering/MODULE_ARCHITECTURE_MIGRATION_PLAN.md \
       docs/engineering/CODE_REVIEW.md \
       docs/engineering/UNIVERSE_MANAGEMENT_REMEDIATION_PLAN.md \
       docs/engineering/WORKSPACE_CHAT_ANALYSIS.md
git rm -r docs/engineering/predictive-improvement/
```

- [ ] **Step 2: Verify deletions**

```bash
ls docs/engineering/
```

Expected: only these files remain: `AI_RUNTIME_ARCHITECTURE.md`, `CODE_HEALTH.md`, `DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md`, `DATABASE_MIGRATION.md`, `FRAGILE_DATA_ACQUISITION_PATTERNS_AND_SAFE_ALTERNATIVES.md`, `GITHUB_ACTIONS.md`, `MODULE_ARCHITECTURE.md`, `OPERATIONAL_GUIDE.md`, `ROADMAP.md`, `TROUBLESHOOTING.md`

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: delete planning and archived docs"
```

---

### Task 2: Rewrite CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace CLAUDE.md**

Write this complete content to `CLAUDE.md`:

```markdown
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
| Agent CLI | `agent/cli.py` | argparse CLI, calls service factories directly |
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

## Feature Context

For deeper context on a specific area:
- Backend modules: `docs/engineering/MODULE_ARCHITECTURE.md`
- API surface: `api/README.md`
- Web UI pages and features: `web-ui/docs/WEB_UI_GUIDE.md`
- Intelligence module: `src/swing_screener/intelligence/README.md`
- Config options: `config/README.md`
- Runtime data schema: `data/README.md`
- Roadmap: `docs/engineering/ROADMAP.md`
- Troubleshooting: `docs/engineering/TROUBLESHOOTING.md`
```

- [ ] **Step 2: Verify the file looks correct — confirm these sections are gone**

```bash
grep -n "Core Library Modules\|Configuration Surfaces\|Runtime State (JSON" CLAUDE.md
```

Expected: no matches (those sections were removed).

- [ ] **Step 3: Confirm Feature Context section is present**

```bash
grep -n "Feature Context" CLAUDE.md
```

Expected: one match near the bottom.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: trim CLAUDE.md to hub with feature context links"
```

---

### Task 3: Fix README.md

**Files:**
- Modify: `README.md`

Issues to fix:
1. `mcp_server/` directory does not exist — remove from Architecture section and Documentation links.
2. Agent is described as "MCP client" but agent/README.md says it calls services directly, no MCP.
3. `docs/engineering/WORKSPACE_CHAT_ANALYSIS.md` is deleted in Task 1 — remove from Documentation.
4. `src/swing_screener/intelligence/README.md` is being created — add it.

- [ ] **Step 1: Write the corrected README.md**

```markdown
# Swing Screener

Swing Screener is a deterministic, risk-first swing-trading system for end-of-day workflows on US equities. It helps you screen candidates, size risk in R-multiples, review positions, and keep execution manual.

## Start Here

- [Overview](docs/overview/WELCOME.md)
- [Documentation Index](docs/overview/INDEX.md)
- [Repo Conventions](docs/overview/AGENTS.md)

## Main Interfaces

- Web UI: browser-first workflow for daily review, research, book, and strategy
- API: FastAPI backend for the web app and local integrations
- Agent CLI: workflow automation and chat, calls services directly (no HTTP hop)

## Local Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cd web-ui
npm install
```

## Run Locally

Backend API:

```bash
python -m uvicorn api.main:app --port 8000 --reload
```

Frontend:

```bash
cd web-ui
npm run dev
```

Agent examples:

```bash
python -m agent.cli screen --universe mega_all --strategy-id default --top 10
python -m agent.cli positions review
python -m agent.cli chat "What pending orders do I have?"
```

## Architecture

- `src/swing_screener/`: core trading, risk, execution, portfolio, and intelligence logic
- `api/`: FastAPI layer and shared business services
- `agent/`: workflow CLI, calls API services directly
- `web-ui/`: React frontend
- `data/`: local JSON runtime state

## Documentation

Core:

- [Web UI Guide](web-ui/docs/WEB_UI_GUIDE.md)
- [API README](api/README.md)
- [Agent README](agent/README.md)

AI / LLM:

- [AI Runtime Architecture](docs/engineering/AI_RUNTIME_ARCHITECTURE.md)
- [Intelligence Module README](src/swing_screener/intelligence/README.md)

Operations:

- [Daily Usage Guide](docs/product/DAILY_USAGE_GUIDE.md)
- [Operational Guide](docs/engineering/OPERATIONAL_GUIDE.md)
- [Troubleshooting](docs/engineering/TROUBLESHOOTING.md)
- [Roadmap](docs/engineering/ROADMAP.md)

## Testing

Backend:

```bash
pytest -q
```

Frontend:

```bash
cd web-ui
npm test
```

## Principles

- deterministic logic over discretionary behavior
- risk-first trade selection and management
- post-close workflows, not intraday automation
- local files as the default source of truth
- manual execution by design
```

- [ ] **Step 2: Verify no dead references remain**

```bash
grep -n "mcp_server\|WORKSPACE_CHAT_ANALYSIS\|MCP Server" README.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: remove dead mcp_server and WORKSPACE_CHAT_ANALYSIS refs from README"
```

---

### Task 4: Fix config/README.md

**Files:**
- Modify: `config/README.md`

The "Related Documentation" section at the bottom references `mcp_server/docs/` files that do not exist.

- [ ] **Step 1: Remove the dead Related Documentation section**

Find and remove the "Related Documentation" block at the bottom of `config/README.md`:

```
## Related Documentation

- [MCP Architecture](../mcp_server/docs/MCP_ARCHITECTURE.md) - Complete architecture design
- [MCP Feature Map](../mcp_server/docs/MCP_FEATURE_MAP.md) - All available features
- [MCP Usage Guide](../mcp_server/docs/MCP_USAGE_GUIDE.md) - How to use MCP server
- [MCP Implementation Roadmap](../mcp_server/docs/MCP_IMPLEMENTATION_ROADMAP.md) - Development plan
```

Replace it with nothing (delete those 6 lines).

- [ ] **Step 2: Remove inline mcp_server reference (line 53)**

Find:
```
Changes require MCP server restart.

**Documentation:** See `mcp_server/docs/` for complete documentation.
```

Replace with:
```
Changes require MCP server restart.
```

(Delete the blank line and the `**Documentation:**` line.)

- [ ] **Step 3: Verify**

```bash
grep -n "mcp_server" config/README.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add config/README.md
git commit -m "docs: remove dead mcp_server links from config/README"
```

---

### Task 5: Write src/swing_screener/intelligence/README.md

**Files:**
- Create: `src/swing_screener/intelligence/README.md`

- [ ] **Step 1: Write the file**

```markdown
# Intelligence Module

Post-close LLM enrichment for screener candidates and open positions.

## Purpose

Given a ticker, builds a structured context snapshot (OHLCV features, fundamentals, Finnhub signals) and sends it to an LLM for swing-trading analysis. Output is a `SymbolIntelligence` result with narrative, action recommendation, and catalyst context. Results are cached per ticker (TTL-based, stored in `data/intelligence/`).

## Files

| File | Purpose |
|------|---------|
| `symbol_analyzer.py` | Entry point. Assembles context → LLM prompt → parses `SymbolIntelligence`. |
| `models.py` | `SymbolIntelligence`, `SymbolIntelligenceRequest` data contracts. |
| `cache.py` | Per-ticker JSON cache. Reads/writes to `data/intelligence/`. |
| `catalysts/generator.py` | AI-assisted catalyst report generation. |
| `catalysts/models.py` | Catalyst data models. |
| `catalysts/prompts.py` | Prompt templates for catalyst analysis. |
| `catalysts/store.py` | Catalyst persistence (`data/intelligence/`). |

## API Surface

```
POST /api/intelligence/{ticker}        — run analysis; cache result
GET  /api/intelligence/{ticker}/latest — return most-recent cached result
POST /api/intelligence/sweep           — batch run across watchlist + open positions
```

Router: `api/routers/intelligence.py`
Service: `api/services/intelligence_service.py`
Core: `symbol_analyzer.py`

## Input Context

The analyzer assembles context from:
- OHLCV features (Close, ATR%, SMA trend, momentum, 52w high proximity)
- Fundamentals snapshot (P/E, revenue growth, gross margin, balance sheet signals)
- Finnhub signals (insider transactions, forward EPS estimate, upgrade/downgrade actions)
- Open position details (if ticker is already held — switches action to `MANAGE_ONLY`)

## Configuration

`config/intelligence.yaml` — LLM provider (OpenAI), model, temperature, signal type toggles.

API keys go in environment variables, not the config file.

## Caching

Results stored as JSON under `data/intelligence/<ticker>_analysis.json`. TTL is set in `config/intelligence.yaml`. `cache.py` exposes `get_cached_analysis(ticker)` → returns `None` on miss or expiry.

## Action Types

`SymbolIntelligence.action` is one of:
- `BUY_NOW` — entry signal active at current price
- `BUY_ON_PULLBACK` — waiting for price to pull back to planned entry level
- `MANAGE_ONLY` — position already held; narrative is position-management focused
- `SKIP` — no actionable signal
```

- [ ] **Step 2: Verify the file exists**

```bash
ls src/swing_screener/intelligence/README.md
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add src/swing_screener/intelligence/README.md
git commit -m "docs: add intelligence module README"
```

---

### Task 6: Fix docs/overview/INDEX.md

**Files:**
- Modify: `docs/overview/INDEX.md`

- [ ] **Step 1: Write the corrected INDEX.md**

```markdown
# Documentation Index

> Status: current.  
> Last reviewed: 2026-06-01.

## Overview
- `/README.md`
- `/docs/overview/WELCOME.md`
- `/docs/overview/AGENTS.md`

## AI / LLM Canonical Docs
- `/docs/engineering/AI_RUNTIME_ARCHITECTURE.md`
- `/src/swing_screener/intelligence/README.md`

## Engineering
- `/docs/engineering/DATA_SOURCE_AUDIT_AND_PROVIDER_STRATEGY.md`
- `/docs/engineering/ROADMAP.md`
- `/docs/engineering/MODULE_ARCHITECTURE.md`
- `/docs/engineering/DATABASE_MIGRATION.md`
- `/docs/engineering/OPERATIONAL_GUIDE.md`
- `/docs/engineering/TROUBLESHOOTING.md`
- `/docs/engineering/GITHUB_ACTIONS.md`
- `/docs/engineering/CODE_HEALTH.md`
- `/docs/engineering/FRAGILE_DATA_ACQUISITION_PATTERNS_AND_SAFE_ALTERNATIVES.md`

## Product
- `/docs/product/COMBINED_ANALYSIS_REASONING.md`
- `/docs/product/DAILY_USAGE_GUIDE.md`

## Education
- `/docs/education/RECOMMENDED_LOGIC_BEGINNER_GUIDE.md`
- `/docs/education/RECOMMENDED_LOGIC_BEGINNER_GUIDE_EN.md`
- `/docs/education/RECOMMENDED_LOGIC_UI_COPY.md`

## Module Docs

API:
- `/api/README.md`

Web UI:
- `/web-ui/README.md`
- `/web-ui/docs/WEB_UI_GUIDE.md`
- `/web-ui/docs/WEB_UI_ARCHITECTURE.md`

Agent:
- `/agent/README.md`

Data:
- `/data/README.md`

Intelligence:
- `/src/swing_screener/intelligence/README.md`

Config:
- `/config/README.md`

## Repo Policy Docs
- `/.github/BRANCH_PROTECTION.md`
- `/.github/copilot-instructions.md`
```

- [ ] **Step 2: Verify dead references are gone**

```bash
grep -n "DATA_SOURCE_ROADMAP\|BROKER_INTEGRATION\|INDICATOR_VALIDATION\|BACKEND_CLEANUP\|COMBINED_ANALYSIS_IMPLEMENTATION\|WORKSPACE_CHAT_ANALYSIS\|MODULE_ARCHITECTURE_MIGRATION\|CODE_REVIEW\|UNIVERSE_MANAGEMENT" docs/overview/INDEX.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/overview/INDEX.md
git commit -m "docs: fix INDEX.md — remove dead refs, add intelligence README, update date"
```

---

### Task 7: Fix .github/copilot-instructions.md

**Files:**
- Modify: `.github/copilot-instructions.md`

Three fixes:
1. Two `AGENTS.md` links point to `../AGENTS.md` (root) — correct path is `../docs/overview/AGENTS.md`.
2. Link to `../web-ui/docs/DAILY_REVIEW_IMPLEMENTATION.md` — file does not exist, remove the line.
3. "158 comprehensive tests (51 unit, 24 component, 87 integration)" — stale after dead-code deletion, replace with generic phrasing.

- [ ] **Step 1: Fix AGENTS.md path on line ~8**

Find:
```
**Before making any changes, read [AGENTS.md](../AGENTS.md) in the repository root.**
```

Replace with:
```
**Before making any changes, read [AGENTS.md](../docs/overview/AGENTS.md).**
```

- [ ] **Step 2: Fix the bottom AGENTS.md link (line ~184)**

Find:
```
_For complete details, see [AGENTS.md](../AGENTS.md) in the repository root._
```

Replace with:
```
_For complete details, see [AGENTS.md](../docs/overview/AGENTS.md)._
```

- [ ] **Step 3: Remove the dead DAILY_REVIEW_IMPLEMENTATION.md link**

Find:
```
- **[docs/DAILY_REVIEW_IMPLEMENTATION.md](../web-ui/docs/DAILY_REVIEW_IMPLEMENTATION.md)** - Recent implementation patterns
```

Delete that line entirely.

- [ ] **Step 4: Fix the stale test count**

Find:
```
- 158 comprehensive tests (51 unit, 24 component, 87 integration)
```

Replace with:
```
- comprehensive test suite (Vitest + React Testing Library + MSW)
```

- [ ] **Step 5: Verify**

```bash
grep -n "AGENTS.md\|DAILY_REVIEW\|158 comprehensive" .github/copilot-instructions.md
```

Expected: two AGENTS.md matches (both now pointing to `../docs/overview/AGENTS.md`), no DAILY_REVIEW match, no "158 comprehensive" match.

- [ ] **Step 6: Commit**

```bash
git add .github/copilot-instructions.md
git commit -m "docs: fix copilot-instructions — AGENTS.md path, dead link, stale test count"
```

---

### Task 8: Update web-ui/README.md

**Files:**
- Modify: `web-ui/README.md`

- [ ] **Step 1: Write the corrected web-ui/README.md**

```markdown
# Swing Screener Web UI

React + TypeScript frontend for Swing Screener.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Daily review compute, pending orders, open risk summary |
| Calendar | `/calendar` | Earnings calendar and catalyst events |
| Book | `/book` | Open positions and order management |
| Research | `/research` | Screener candidates, symbol intelligence, watchlist |
| Universes | `/universes` | Universe management and refresh |
| Strategy | `/strategy` | Strategy config and activation |
| Journal | `/journal` | Weekly reviews and trade log |
| Onboarding | `/onboarding` | Setup guide |
| Analytics | `/analytics` | Regime breakdown and performance analytics |
| Fundamentals | `/fundamentals` | Fundamental data browser |

## Docs
- `web-ui/docs/WEB_UI_GUIDE.md` — pages, feature map, testing patterns
- `web-ui/docs/WEB_UI_ARCHITECTURE.md` — component and state architecture
- `docs/overview/INDEX.md` — full documentation index

## Development
```bash
cd web-ui
npm install
npm run dev
```

## Persistence Mode
- `VITE_PERSISTENCE_MODE=api` (default) — uses backend API and file storage.
- `VITE_PERSISTENCE_MODE=local` — activates browser localStorage (only when `VITE_ENABLE_LOCAL_PERSISTENCE=true`).
```

- [ ] **Step 2: Verify old page names are gone**

```bash
grep -n "Dashboard\|Screener\|Orders\|Positions\|Daily Review\|Settings" web-ui/README.md
```

Expected: no matches (these were the old page names).

- [ ] **Step 3: Commit**

```bash
git add web-ui/README.md
git commit -m "docs: update web-ui README with current pages"
```

---

### Task 9: Rewrite web-ui/docs/WEB_UI_GUIDE.md

**Files:**
- Modify: `web-ui/docs/WEB_UI_GUIDE.md`

- [ ] **Step 1: Write the new WEB_UI_GUIDE.md**

```markdown
# Web UI Guide

> Status: current.  
> Last reviewed: 2026-06-01.

## Purpose

Daily trading workflow through the Swing Screener web interface.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| Today | `/today` | Compute daily review, check pending orders, open risk summary |
| Calendar | `/calendar` | Earnings calendar, upcoming catalyst events |
| Book | `/book` | Open positions: stop updates, partial close, trail config; order management: create, fill, cancel |
| Research | `/research` | Screener run and candidates, symbol intelligence analysis, watchlist |
| Universes | `/universes` | Universe management, manual refresh, benchmark |
| Strategy | `/strategy` | Strategy CRUD, activation, and validation |
| Journal | `/journal` | Weekly reviews and trade log |
| Onboarding | `/onboarding` | Setup guide for new users |
| Analytics | `/analytics` | Regime breakdown and performance analytics |
| Fundamentals | `/fundamentals` | Fundamental data browser: snapshot, compare, warmup |

## Feature Directory Map

Each domain has a directory under `web-ui/src/features/<domain>/` with `api.ts` (fetch functions), `hooks.ts` (React Query hooks), and types.

| Feature dir | Feeds page(s) | Domain |
|---|---|---|
| `features/portfolio` | Book | Positions: CRUD, stop updates, partial close, trail method |
| `features/orders` | Book, Today | Order lifecycle: create, fill, cancel |
| `features/screener` | Research | Screener run, candidates, recurrence state |
| `features/intelligence` | Research | Symbol analysis (LLM), cached results, sweep |
| `features/watchlist` | Research | Watchlist CRUD |
| `features/dailyReview` | Today | Daily review compute and structured result |
| `features/analytics` | Analytics | Regime breakdown, performance stats |
| `features/fundamentals` | Fundamentals | Fundamental snapshots, compare, warmup job |
| `features/calendar` | Calendar | Calendar events |
| `features/weeklyReview` | Journal | Weekly review CRUD |
| `features/strategy` | Strategy | Strategy CRUD and activation |
| `features/universes` | Universes | Universe list, detail, refresh, benchmark |
| `features/config` | (cross-cutting) | App config read/write |
| `features/persistence` | (cross-cutting) | API vs localStorage mode toggle |

## Typical Workflow

1. Start API and web UI.
2. **Today** — compute daily review, check pending orders.
3. **Research** — run screener, review candidates, trigger intelligence analysis.
4. Create orders via **Book**.
5. Next trading day: fill orders and update stops in **Book**.

Full timing guidance: `docs/product/DAILY_USAGE_GUIDE.md`.

## Testing

- Run `npm test` before and after any change.
- Use `renderWithProviders()` for component tests (wraps React Query + Zustand).
- Mock API calls with MSW handlers in `web-ui/src/test/mocks/handlers.ts`.
- Assert user-facing copy via i18n keys (`web-ui/src/i18n/`), not hardcoded strings.
- Coverage thresholds enforced: 80%+ lines, 75%+ branches.
```

- [ ] **Step 2: Verify old page names are gone**

```bash
grep -n "Dashboard\|Screener\|Orders\|Positions\|Daily Review\|Settings" web-ui/docs/WEB_UI_GUIDE.md
```

Expected: no matches (those were the old page names — "Screener" now appears only in feature map rows, not as a page name).

- [ ] **Step 3: Commit**

```bash
git add web-ui/docs/WEB_UI_GUIDE.md
git commit -m "docs: rewrite WEB_UI_GUIDE with current pages and feature map"
```

---

### Task 10: Update web-ui/docs/WEB_UI_ARCHITECTURE.md

**Files:**
- Modify: `web-ui/docs/WEB_UI_ARCHITECTURE.md`

- [ ] **Step 1: Write the updated WEB_UI_ARCHITECTURE.md**

```markdown
# Web UI Architecture

> Status: current.  
> Last reviewed: 2026-06-01.

## Directory Structure

| Path | Purpose |
|------|---------|
| `src/pages/` | Top-level page components — one file per route |
| `src/features/` | Domain feature dirs — each owns `api.ts`, `hooks.ts`, and types |
| `src/components/domain/` | Reusable domain components (not page-specific) |
| `src/components/common/` | Generic UI primitives |
| `src/types/` | Type transforms: `snake_case` API payload → `camelCase` frontend type |
| `src/lib/` | Shared React Query keys (`queryKeys.ts`), API endpoint constants (`api.ts`) |
| `src/i18n/` | All user-facing strings |
| `src/stores/` | Zustand stores |
| `src/test/` | MSW handlers, `renderWithProviders()`, test utilities |

## Contracts

- API payloads arrive as `snake_case`. Transform functions in `src/types/` convert to `camelCase` before use in components. Never use raw API shape inside components.
- React Query keys live in `src/lib/queryKeys.ts`. Always use these for cache invalidation — do not construct key arrays inline.
- All user-facing strings go through `src/i18n/`. No hardcoded copy in components or tests.

## State

- Server state: React Query (auto-caching and invalidation via query keys).
- Client/UI state: Zustand stores in `src/stores/`.
- No local persistence by default (`VITE_PERSISTENCE_MODE=api`).

## Testing

- Component tests use `renderWithProviders()` — wraps React Query client and Zustand stores.
- API calls mocked via MSW (`src/test/mocks/handlers.ts`).
- Run all tests: `npm test` (Vitest + React Testing Library).
- Run single feature: `npx vitest run src/features/<domain>`.
```

- [ ] **Step 2: Verify last reviewed date is updated**

```bash
grep "Last reviewed" web-ui/docs/WEB_UI_ARCHITECTURE.md
```

Expected: `Last reviewed: 2026-06-01.`

- [ ] **Step 3: Commit**

```bash
git add web-ui/docs/WEB_UI_ARCHITECTURE.md
git commit -m "docs: update WEB_UI_ARCHITECTURE to current structure"
```

---

### Task 11: Self-check — verify no remaining dead references

- [ ] **Step 1: Search for any remaining references to deleted files**

```bash
grep -r "BACKEND_CLEANUP_AUDIT\|BACKEND_CLEANUP_ROADMAP\|COMBINED_ANALYSIS_IMPLEMENTATION_PLAN\|PREDICTIVE_AND_EXPLANATION\|predictive-improvement\|MODULE_ARCHITECTURE_MIGRATION\|WORKSPACE_CHAT_ANALYSIS\|UNIVERSE_MANAGEMENT_REMEDIATION\|DATA_SOURCE_ROADMAP\|DAILY_REVIEW_IMPLEMENTATION\|mcp_server" \
  --include="*.md" \
  --exclude-dir=".git" \
  --exclude-dir=".venv" \
  --exclude-dir="node_modules" \
  --exclude-dir="docs/superpowers" \
  .
```

Expected: no matches outside of `docs/superpowers/` (plans and specs may still reference them as historical context — that is acceptable).

- [ ] **Step 2: Confirm intelligence README is reachable from CLAUDE.md and INDEX.md**

```bash
grep "intelligence/README" CLAUDE.md docs/overview/INDEX.md
```

Expected: one match in each file.

- [ ] **Step 3: Final commit if any loose files remain uncommitted**

```bash
git status
```

If any modified files are still unstaged, stage and commit them. If everything is clean, no action needed.
