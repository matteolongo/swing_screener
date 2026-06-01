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
