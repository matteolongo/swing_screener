# Swing Screener Agent

Automation layer that orchestrates Swing Screener workflows through the real stdio MCP server.

## Capabilities
- Daily screening and candidate review
- Order creation, fill, and cancellation
- Position review, stop suggestions, stop updates, and closes
- Daily review aggregation

## Dependencies
- MCP dependency installed in the active Python environment (`uv sync --extra mcp`)
- MCP tools enabled in `config/mcp_features.yaml`

The agent launches `python -m mcp_server.main` by default and discovers tools from the live MCP registry. Pass `server_command=[...]` to `SwingScreenerAgent(...)` if you need a different launch command.

## CLI
Examples (see `python -m agent.cli --help` for full options):
- `python -m agent.cli screen --universe mega_all --strategy-id default --top 10`
- `python -m agent.cli orders list --status pending`
- `python -m agent.cli orders fill ORD-123 102.45 --filled-date 2026-03-17`
- `python -m agent.cli positions review`
- `python -m agent.cli positions update-stop POS-123 98.10`
- `python -m agent.cli positions suggest-stops`
- `python -m agent.cli daily-review`

## Python API
Primary entry point: `SwingScreenerAgent`.
Common methods:
- `daily_screening(universe, strategy_id, top)`
- `review_positions()`
- `create_order_from_candidate(candidate)`
- `suggest_stop_updates()`
- `update_position_stop(position_id, new_stop)`
- `fill_order(order_id, filled_price, filled_date)`
- `close_position(position_id, exit_price, exit_date)`
- `daily_review()`

Screening candidates returned by the agent use the screener schema directly: `entry`, `stop`, and `target`.

## MCP Tool Coverage
The agent calls MCP tools exposed by `mcp_server` (see `mcp_server/README.md` for the tool list).
