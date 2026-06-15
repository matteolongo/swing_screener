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

## Environment Variables

Copy `.env.example` to `.env` at the repo root before running the API or AI features:

```bash
cp .env.example .env
```

The backend loads the repo-root `.env` automatically when `api.main` starts. The most common variables are:

| Variable | Required? | Used by | Notes |
|----------|-----------|---------|-------|
| `OPENAI_API_KEY` | Required for Analyze with AI and catalyst generation | Intelligence / catalyst endpoints | Needed by `POST /api/intelligence/{ticker}` and catalyst routes. |
| `OPENAI_BASE_URL` | Optional | OpenAI-compatible runtime helpers | Defaults to `https://api.openai.com/v1`; set only when using a compatible proxy/gateway. |
| `FINNHUB_API_KEY` | Recommended for richer analysis | Calendar, earnings proximity, analyst/insider enrichment | Without it, related enrichment degrades or returns setup errors. |
| `EODHD_API_KEY` or `EOD_HISTORICAL_DATA_API_KEY` | Optional | Exchange/symbol discovery | Used for EODHD-backed exchange discovery. |
| `SWING_SCREENER_PROVIDER` | Optional | Market data provider factory | Defaults to `yfinance`; set to `alpaca` to use Alpaca market data. |
| `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPACA_PAPER` | Required only when `SWING_SCREENER_PROVIDER=alpaca` | Alpaca market data / broker config | `ALPACA_PAPER` defaults to `true`. |
| `SEC_CONTACT_EMAIL` | Optional but recommended | SEC EDGAR fundamentals provider | Helps satisfy SEC fair-access User-Agent guidance. |
| `SWING_SCREENER_PROJECT_ROOT`, `SWING_SCREENER_CONFIG_DIR`, `SWING_SCREENER_DATA_DIR` | Optional | Runtime path overrides | Defaults work for local repo usage. |
| `SCREENER_RUN_MODE` | Optional | Screener API route | `sync` or `async`; defaults to `async` on Heroku dynos and `sync` elsewhere. |
| `SERVE_WEB_UI`, `WEB_UI_DIST_DIR` | Optional | FastAPI static frontend serving | Useful when serving a built React app from the API process. |

For the React dev server, set frontend variables in `web-ui/.env.local` when needed:

| Variable | Required? | Notes |
|----------|-----------|-------|
| `VITE_API_URL` | Optional | Backend base URL for the Vite app, for example `http://localhost:8000`. |
| `VITE_PERSISTENCE_MODE` | Optional | Persistence mode override for the web UI. |
| `VITE_ENABLE_LOCAL_PERSISTENCE` | Optional | Enables local persistence opt-in behavior. |

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
- post-close decision workflows; current-price previews may be read-only, but never automate intraday decisions or execution
- local files as the default source of truth
- manual execution by design
