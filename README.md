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

**New to this codebase?** Start with **[WELCOME.md](WELCOME.md)** for complete onboarding.

**Quick reference:**
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - GitHub Copilot configuration (auto-loaded by Copilot)
- **[AGENTS.md](AGENTS.md)** - Complete guide: project philosophy and constraints (read this!)
- **[ROADMAP.md](ROADMAP.md)** - Feature status and priorities
- **[docs/DAILY_REVIEW_IMPLEMENTATION.md](docs/DAILY_REVIEW_IMPLEMENTATION.md)** - Recent implementation patterns

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

👉 **See [docs/WEB_UI_GUIDE.md](docs/WEB_UI_GUIDE.md) for complete Web UI documentation**

---

### 🐳 Docker (Dev)

Dev-only Docker Compose setup for API + Vite dev server:

```bash
docker compose up --build
```

Then open [http://localhost:5173](http://localhost:5173)

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
  backtest/             # Deterministic historical simulation in R units

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

See [docs/BROKER_INTEGRATION.md](docs/BROKER_INTEGRATION.md) for complete setup guide.

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
- **[Web UI Guide](docs/WEB_UI_GUIDE.md)** — Complete Web UI documentation (recommended)
- **[CLI Usage](#cli-usage)** — Command-line interface reference (see above)

### Operational Guides
- **[Operational Guide](docs/OPERATIONAL_GUIDE.md)** — Day-to-day CLI workflows
- **[Daily Usage Guide](docs/DAILY_USAGE_GUIDE.md)** — Daily routine and timing (Barcelona/CET)
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** — Common issues and solutions ⭐ **NEW**

### Technical References
- **[API Documentation](api/README.md)** — FastAPI REST API reference (18 endpoints, health checks, monitoring)
- **[MCP Server Documentation](mcp_server/README.md)** — Model Context Protocol server (22 tools for AI assistants) ⭐ **NEW**
- **[Web UI README](web-ui/README.md)** — React/TypeScript architecture
- **[Broker Integration](docs/BROKER_INTEGRATION.md)** — Market data providers (yfinance, Alpaca) ⭐ **NEW**
- **[Indicator Validation](docs/INDICATOR_VALIDATION.md)** — TA-Lib validation approach ⭐ **NEW**
- **[AGENTS.md](AGENTS.md)** — Guide for AI coding assistants

### Planning
- **[ROADMAP.md](ROADMAP.md)** — Feature roadmap and priorities

## Technical Indicators

The Swing Screener uses simple, transparent technical indicators:
- **SMA** (Simple Moving Average) - Trend identification
- **ATR** (Average True Range) - Volatility measurement
- **Momentum** - Price returns over lookback periods

All indicators are **validated against TA-Lib** (industry-standard library) to ensure correctness
while maintaining code simplicity. See [`docs/INDICATOR_VALIDATION.md`](docs/INDICATOR_VALIDATION.md) for details.
