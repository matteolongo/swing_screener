# Swing Screener

A deterministic, risk-first swing-trading framework for end-of-day US and EU equity workflows. Built to answer one question every evening: given everything that moved today, what do I want to own tomorrow and at what size?

All execution stays manual. The system screens, sizes, and analyzes. You decide and click.

---

## What it does

**Screening.** Pulls EOD price data for 14+ pre-built universes (S&P 500, Nasdaq, Amsterdam, Europe mid-cap, sector ETFs) and surfaces the top-ranked candidates by setup quality: momentum, entry signal, volume confirmation.

**Position sizing.** Every size is computed in R-multiples: `1R = entry - stop`. No fixed-dollar or percentage-based sizing, ever. The risk model accounts for portfolio heat, regime scaling, and sector concentration.

**AI analysis.** An LLM-powered intelligence layer analyzes each candidate in two passes: a quick signal read, then a deep evidence sweep pulling in price action context, SEC filings, and held positions. Returns a structured trade plan with specific entry, stop, and target.

**Portfolio tracking.** Manages open positions through their full lifecycle: entry, trail, exit. Tracks R-multiples realized, stop adjustments, and exhaustion scores.

**DeGiro integration.** Reads your portfolio and fee data from DeGiro directly. Order placement stays manual.

**Data source diagnostics.** Built-in diagnostics page shows which providers are healthy, what's cached, and what failed.

---

## Daily workflow

Post-market-close, roughly 15 minutes:

1. Open the app. The **Today** tab loads automatically with today's screener run.
2. Review screener candidates. Check setup quality and sector concentration warnings.
3. Run AI analysis on the setups that look interesting.
4. Check held positions: trail stops if needed, flag exhausted names for exit.
5. Place orders manually in DeGiro using the computed entries and sizes.
6. Close the laptop.

Details in [`docs/product/DAILY_USAGE_GUIDE.md`](docs/product/DAILY_USAGE_GUIDE.md). DeGiro order setup mechanics in [`docs/product/DEGIRO_ORDER_SETUP.md`](docs/product/DEGIRO_ORDER_SETUP.md).

---

## Non-goals

Never add:

- Live trading or broker APIs that auto-execute
- Intraday logic or tick-level data
- ML or curve-fitting on historical returns
- Hidden state or heuristic magic not traceable to a config file

---

## Setup

```bash
# Backend (uv recommended)
uv sync
# or: python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"

# Run API
python -m uvicorn api.main:app --port 8000 --reload

# Frontend (separate terminal)
cd web-ui && npm install && npm run dev
```

Open `http://localhost:5173`.

### Environment variables

Copy `.env.example` to `.env` at the repo root before running the API.

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | For AI analysis | Claude API key, used by `POST /api/intelligence/{ticker}` and all intelligence endpoints |
| `SWING_SCREENER_PROVIDER` | No (defaults to `yfinance`) | EOD data provider: `yfinance` or `alpaca` |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | If using Alpaca | Alpaca market data keys. `ALPACA_PAPER` defaults to `true` |
| `FINNHUB_API_KEY` | No (degrades analysis) | Calendar, earnings proximity, analyst and insider enrichment |
| `EODHD_API_KEY` | No | Exchange and symbol discovery via EODHD |
| `SEC_CONTACT_EMAIL` | No (recommended) | Satisfies SEC EDGAR fair-access User-Agent guidance |
| `SWING_SCREENER_PROJECT_ROOT` | No | Runtime path override; defaults work for local repo |

Frontend dev server (`web-ui/.env.local`):

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Backend base URL, e.g. `http://localhost:8000` |

Full config reference: [`config/README.md`](config/README.md).

---

## Architecture

```
src/swing_screener/    Core trading logic: screening, risk, portfolio, execution, intelligence
api/                   FastAPI REST layer: routers, services, repositories
web-ui/                React 18 + TypeScript UI (Zustand, React Query, Vite)
config/                YAML config (provider, intelligence, risk, LLM)
data/                  Runtime state: positions.json, orders.json
```

Layer responsibilities: [`docs/engineering/MODULE_ARCHITECTURE.md`](docs/engineering/MODULE_ARCHITECTURE.md).
API surface: [`api/README.md`](api/README.md).
Frontend guide: [`web-ui/docs/WEB_UI_GUIDE.md`](web-ui/docs/WEB_UI_GUIDE.md).
Intelligence pipeline: [`src/swing_screener/intelligence/README.md`](src/swing_screener/intelligence/README.md).

---

## Tests

```bash
# Full suite
pytest -q && cd web-ui && npm test

# Backend only
pytest -q
pytest -m "not integration" -q   # skip tests requiring API keys

# Frontend only
cd web-ui && npm test
npm run typecheck
npm run lint
```

---

## Documentation

Full map: [`docs/overview/INDEX.md`](docs/overview/INDEX.md).

Key starting points:

| What | Where |
| --- | --- |
| Daily trading workflow | [`docs/product/DAILY_USAGE_GUIDE.md`](docs/product/DAILY_USAGE_GUIDE.md) |
| DeGiro order setup | [`docs/product/DEGIRO_ORDER_SETUP.md`](docs/product/DEGIRO_ORDER_SETUP.md) |
| Module architecture | [`docs/engineering/MODULE_ARCHITECTURE.md`](docs/engineering/MODULE_ARCHITECTURE.md) |
| Intelligence pipeline | [`src/swing_screener/intelligence/README.md`](src/swing_screener/intelligence/README.md) |
| Config reference | [`config/README.md`](config/README.md) |
| Roadmap | [`docs/engineering/ROADMAP.md`](docs/engineering/ROADMAP.md) |

---

## Principles

- **Deterministic logic** over discretionary behavior. Every screener output is reproducible given the same EOD data.
- **Risk-first.** Position size flows from `1R = entry - stop`, not from conviction or gut feel.
- **Post-close only.** Current-price previews are read-only context. No intraday decisions, no auto-execution.
- **Local files as source of truth.** `data/positions.json` and `data/orders.json` are the book.
- **Manual execution by design.** The system tells you what to do. You decide whether to do it.
