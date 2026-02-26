# Swing Screener

Swing Screener is a conservative, rule-based framework for **daily swing trading** on US equities.
It helps you:

- screen a stock universe after market close
- rank candidates with transparent indicators (trend, momentum, ATR)
- size positions with strict R-based risk rules
- manage open positions with stop/exit suggestions

Execution is intentionally **manual** (Degiro-friendly).

---

## 🤖 For AI Agents

**New to this codebase?** Start with **[docs/overview/WELCOME.md](docs/overview/WELCOME.md)** for complete onboarding.

**Quick reference:**
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - GitHub Copilot configuration (auto-loaded by Copilot)
- **[docs/overview/AGENTS.md](docs/overview/AGENTS.md)** - Complete guide: project philosophy and constraints (read this!)
- **[docs/engineering/ROADMAP.md](docs/engineering/ROADMAP.md)** - Feature status and priorities
- **[docs/overview/INDEX.md](docs/overview/INDEX.md)** - Documentation map (canonical vs historical)

---

## Two Ways to Use

### 🌐 Web UI (Recommended)

Modern browser-based interface with full CRUD operations for positions, orders, and screener execution.

**Quick Start:**

```bash
# Terminal 1: Start backend API
python -m uvicorn api.main:app --port 8000 --reload

# Terminal 2: Start frontend
cd web-ui && npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

👉 **See [web-ui/docs/WEB_UI_GUIDE.md](web-ui/docs/WEB_UI_GUIDE.md) for complete Web UI documentation**

---

### 🐳 Docker (Dev)

Dev-only Docker Compose setup for API + Vite dev server:

```bash
docker compose up --build
```

Then open [http://localhost:5173](http://localhost:5173)

---

### ☁️ Heroku (Single App: API + UI)

Deploy one Heroku app that serves both:
- FastAPI under `/api/*`
- built React app from the same origin (mobile-friendly, no CORS setup needed)

**Files included for this flow:**
- `Procfile` (web dyno command)
- `package.json` (runs `heroku-postbuild` to build `web-ui`)
- `scripts/heroku_build_ui.sh`
- `scripts/heroku_start.sh`
- `app.json` (buildpack order + defaults)
- `.python-version` (pins Python runtime)
- `pyproject.toml` + `uv.lock` (Python dependency source of truth)

**One-time app setup:**

```bash
# Create app (skip if already created)
heroku create <app-name>

# Buildpacks must be in this exact order:
heroku buildpacks:clear -a <app-name>
heroku buildpacks:add --index 1 heroku/nodejs -a <app-name>
heroku buildpacks:add --index 2 heroku/python -a <app-name>

# Runtime configuration
heroku config:set SERVE_WEB_UI=auto -a <app-name>
```

By default, Heroku startup script also sets:
- `SCREENER_RUN_MODE=async` (avoids Heroku 30s request timeout on `/api/screener/run`)
- `WEB_CONCURRENCY=1` (single-worker consistency for background jobs)

**Deploy:**

```bash
git push heroku <branch>:main
```

**Verify build + runtime:**

```bash
# Ensure buildpacks are correct
heroku buildpacks -a <app-name>

# Check build/runtime logs
heroku logs --tail -a <app-name>
```

Look for these lines:
- `Node.js app detected`
- `Building web-ui for Heroku slug...`
- `Web UI mode=auto, index_exists=True`

When those appear, `/` serves the web UI and `/api/*` serves backend endpoints.

**Troubleshooting:**

If `/` returns API JSON and logs show:
- `Web UI mode=enabled, index_exists=False`

then the frontend build artifacts are missing from the slug. Fix by:
1. Re-check buildpack order (`nodejs` first, `python` second).
2. Redeploy (`git push heroku <branch>:main`).
3. Re-check logs for `Building web-ui for Heroku slug...`.

If startup fails with missing modules, ensure:
1. `.python-version` exists at repo root.
2. `uv.lock` is committed and matches `pyproject.toml`.
3. You redeploy after dependency changes.

If screener requests fail with `H12 Request timeout`:
1. Ensure `SCREENER_RUN_MODE=async` (default in `scripts/heroku_start.sh`).
2. Confirm frontend requests to `/api/screener/run` eventually receive data after background polling.
3. Ensure `WEB_CONCURRENCY=1` for this app:
   `heroku config:set WEB_CONCURRENCY=1 -a <app-name>`

---

### 💻 CLI (Advanced)

Command-line interface for automation, scripting, and headless environments.

**Quick Start:**

```bash
swing-screener run --universe mega_all --positions data/positions.json --csv out/report.csv
```

👉 **See [CLI Usage](#cli-usage) below for CLI documentation**

---

### 🤖 MCP Server (AI Integration)

**NEW:** Model Context Protocol (MCP) server for AI assistant integration.

The MCP server exposes Swing Screener functionality to AI assistants like Claude, enabling natural language interaction with the trading system.

**Status:** ✅ **Production Ready** (Phases 1-4 Complete)
- ✅ Configuration system (YAML-based feature toggles)
- ✅ Tool registry with dependency injection
- ✅ Server skeleton and MCP protocol integration
- ✅ **22 tools across 6 feature domains**
  - Portfolio (9 tools) - Complete position/order management
  - Screener (3 tools) - Stock screening and analysis
  - Strategy (4 tools) - Strategy management
  - Config (2 tools) - Application configuration
  - Daily Review (2 tools) - Comprehensive workflow
  - Social (2 tools) - Sentiment analysis

**Quick Start:**

```bash
# Install with MCP dependencies
pip install -e ".[mcp]"

# Start MCP server
python -m mcp_server.main

# Validate configuration
python -m mcp_server.main --validate-only
```

👉 **See [mcp_server/README.md](mcp_server/README.md) for complete MCP documentation**

---

### 🤖 Agent (Workflow Automation)

**NEW:** AI-driven agent for automating trading workflows via MCP.

The Swing Screener Agent connects to the MCP server as a client, orchestrating tool calls to automate daily trading routines while providing educational insights.

**Features:**
- 🔍 Automated screening for trade candidates
- 📊 Position management with stop updates
- 📝 Order creation and tracking
- 💡 Educational insights on every action
- 🛠️ CLI and Python API

**Quick Start:**

```bash
# Run daily screening
python -m agent.cli screen --universe mega_all --top 10

# Review open positions
python -m agent.cli positions review

# Run comprehensive daily review
python -m agent.cli daily-review
```

**Python API:**

```python
from agent import SwingScreenerAgent
import asyncio

async def main():
    agent = SwingScreenerAgent()
    await agent.start()
    
    # Run daily screening
    result = await agent.daily_screening(universe="mega_all", top_n=10)
    
    # Review positions
    positions = await agent.review_positions()
    
    await agent.stop()

asyncio.run(main())
```

👉 **See [agent/README.md](agent/README.md) for complete Agent documentation**

---

## Key Principles

- Deterministic logic over discretionary decisions
- Risk-first sizing and trade management
- One daily workflow (post-close), no intraday automation
- Files as source of truth (`data/positions.json`, `data/orders.json`)

## Project Layout

```text
src/swing_screener/
  cli.py                # CLI entrypoint: run/manage/migrate/universes
  data/                 # Universe loading + market data
  indicators/           # Trend, momentum, volatility (ATR)
  screeners/            # Feature table, filters, ranking
  signals/              # Breakout / pullback entry signals
  risk/                 # Position sizing and trade plans
  reporting/            # Daily report pipeline + exports
  execution/            # Order guidance and order-state models
  portfolio/            # Position state + management + migration helpers

api/                    # FastAPI backend (REST API)
  services/             # Business logic (shared with MCP server)
  routers/              # HTTP endpoints
  models/               # Pydantic request/response models
  repositories/         # Data access layer

mcp_server/             # Model Context Protocol server (22 tools)
  tools/                # MCP tool definitions by domain
    portfolio/          # 9 position/order management tools
    screener/           # 3 screening and analysis tools
    strategy/           # 4 strategy management tools
    config/             # 2 configuration tools
    daily_review/       # 2 daily workflow tools
    social/             # 2 sentiment analysis tools
  config.py             # YAML configuration loader
  protocol.py           # MCP protocol integration
  main.py               # Server entrypoint

agent/                  # Agent (workflow automation via MCP)
  client.py             # MCP client implementation
  agent.py              # Main agent class
  workflows.py          # Workflow orchestration
  cli.py                # Command-line interface
  examples/             # Usage examples

web-ui/                 # React + TypeScript frontend
  src/components/       # UI components
  src/pages/            # Main application pages
  src/stores/           # State management (Zustand)
```

## Installation

### Backend + CLI

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

### MCP Server (Optional)

```bash
# Install with MCP dependencies
pip install -e ".[mcp]"
```

### Web UI (Frontend)

```bash
cd web-ui
npm install
```

---

## CLI Usage

Run the daily screener:

```bash
swing-screener run --universe mega_all --positions data/positions.json --csv out/report.csv
```

Manage open positions:

```bash
swing-screener manage --positions data/positions.json --md out/degiro_actions.md
```

Apply suggested stop updates to local state:

```bash
swing-screener manage --positions data/positions.json --apply --md out/degiro_actions.md
```

Backfill links between `data/orders.json` and `data/positions.json`:

```bash
swing-screener migrate --orders data/orders.json --positions data/positions.json --create-stop-orders
```

Inspect packaged universes:

```bash
swing-screener universes list
```

### Packaged universes (sources)

- `defense_all` (legacy: `mega_defense`) — built from U.S. aerospace/defense ETF holdings (ITA, XAR) and expanded with major global primes from SIPRI's Top 100 list.
  - ITA holdings: https://www.ishares.com/us/products/239502/ishares-us-aerospace-defense-etf
  - XAR holdings: https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-aerospace-defense-etf-xar
  - SIPRI Top 100 arms-producing companies: https://www.sipri.org/databases/armsindustry
- `healthcare_all` (legacy: `mega_healthcare_biotech`) — built from broad healthcare and biotech ETF holdings (VHT, IBB, XBI), covering pharma, medtech, providers, and biotech.
  - VHT holdings: https://stockanalysis.com/etf/vht/holdings/
  - IBB holdings: https://www.ishares.com/us/products/239699/ishares-biotechnology-etf
  - XBI holdings: https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-biotech-etf-xbi

## Core Data Contracts

- **OHLCV**: pandas DataFrame with MultiIndex columns `(field, ticker)`
- **data/positions.json**: single source of truth for open positions
- **data/orders.json**: order lifecycle and position-linked entry/exit orders

### Market Data Providers

Swing Screener supports multiple market data sources:
- **yfinance** (default): Free Yahoo Finance data - no API keys required
- **Alpaca**: Professional market data with paper/live trading support

Configure via environment variables:
```bash
export SWING_SCREENER_PROVIDER=alpaca  # or yfinance (default)
export ALPACA_API_KEY=your_key
export ALPACA_SECRET_KEY=your_secret
```

See [src/swing_screener/data/docs/BROKER_INTEGRATION.md](src/swing_screener/data/docs/BROKER_INTEGRATION.md) for complete setup guide.

## Testing

### Backend Tests

```bash
pytest -q
```

### Frontend Tests

```bash
cd web-ui
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

**Test Coverage:** 158 tests (51 unit, 24 component, 87 integration)

---

## Documentation

### Getting Started
- **[Web UI Guide](web-ui/docs/WEB_UI_GUIDE.md)** — Complete Web UI documentation (recommended)
- **[CLI Usage](#cli-usage)** — Command-line interface reference (see above)
- **[Documentation Index](docs/overview/INDEX.md)** — Full docs map with current vs historical status

### Operational Guides
- **[Operational Guide](docs/engineering/OPERATIONAL_GUIDE.md)** — Day-to-day CLI workflows
- **[Daily Usage Guide](docs/product/DAILY_USAGE_GUIDE.md)** — Daily routine and timing (Barcelona/CET)
- **[Troubleshooting](docs/engineering/TROUBLESHOOTING.md)** — Common issues and solutions ⭐ **NEW**

### Technical References
- **[API Documentation](api/README.md)** — FastAPI REST API reference (18 endpoints, health checks, monitoring)
- **[MCP Server Documentation](mcp_server/README.md)** — Model Context Protocol server (22 tools for AI assistants) ⭐ **NEW**
- **[Sentiment Analysis Plugin Guide](src/swing_screener/social/docs/SENTIMENT_PLUGIN_GUIDE.md)** — Pluggable sentiment analysis system (Reddit, Yahoo Finance, VADER) ⭐ **NEW**
- **[Web UI README](web-ui/README.md)** — React/TypeScript architecture
- **[Broker Integration](src/swing_screener/data/docs/BROKER_INTEGRATION.md)** — Market data providers (yfinance, Alpaca) ⭐ **NEW**
- **[Indicator Validation](src/swing_screener/data/docs/INDICATOR_VALIDATION.md)** — TA-Lib validation approach ⭐ **NEW**
- **[Intelligence Module README](src/swing_screener/intelligence/README.md)** — Architecture, flow, scoring, and configuration
- **[docs/overview/AGENTS.md](docs/overview/AGENTS.md)** — Guide for AI coding assistants

### Planning
- **[docs/engineering/ROADMAP.md](docs/engineering/ROADMAP.md)** — Feature roadmap and priorities

### Historical Notes
- Some `*IMPLEMENTATION*` and `PHASE*` markdown files are historical snapshots.
- Use **[docs/overview/INDEX.md](docs/overview/INDEX.md)** to identify canonical, actively maintained docs.

## Technical Indicators

The Swing Screener uses simple, transparent technical indicators:
- **SMA** (Simple Moving Average) - Trend identification
- **ATR** (Average True Range) - Volatility measurement
- **Momentum** - Price returns over lookback periods

All indicators are **validated against TA-Lib** (industry-standard library) to ensure correctness
while maintaining code simplicity. See [`src/swing_screener/data/docs/INDICATOR_VALIDATION.md`](src/swing_screener/data/docs/INDICATOR_VALIDATION.md) for details.

## Social Sentiment Analysis

**NEW:** Pluggable sentiment analysis system for adding social/news sentiment to strategy confidence:

- **Multiple data sources**: Reddit (default), Yahoo Finance news, or both
- **Multiple analyzers**: Keyword-based (fast), VADER (NLP-enhanced)
- **Extensible architecture**: Add custom providers and analyzers
- **Integrated with risk**: Sentiment affects position sizing and trade vetoes

See [`src/swing_screener/social/docs/SENTIMENT_PLUGIN_GUIDE.md`](src/swing_screener/social/docs/SENTIMENT_PLUGIN_GUIDE.md) for complete documentation and examples.
