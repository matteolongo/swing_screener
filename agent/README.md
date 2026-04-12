# agent

CLI for common trading workflows. Calls `api/services/` directly — no MCP, no subprocess.

## CLI Usage

```bash
# Screening
python -m agent.cli screen --universe mega_all --top 10
python -m agent.cli screen --universe sp500 --strategy-id my_strategy --top 5 --output results.json

# Positions
python -m agent.cli positions review
python -m agent.cli positions suggest-stops
python -m agent.cli positions update-stop <position_id> <new_stop_price>

# Orders
python -m agent.cli orders list
python -m agent.cli orders list --status pending

# Daily review
python -m agent.cli daily-review

# Workspace chat
python -m agent.cli chat "What is my open risk?"
python -m agent.cli chat "Which positions need a stop update?" --ticker AAPL
```

## Service Wiring

Each command instantiates the relevant `api/services/` classes directly using the same construction pattern as `api/dependencies.py`, but without FastAPI's `Depends`. No API server needs to be running.
