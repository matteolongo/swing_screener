# Swing Screener - Roadmap

> **Status: Current snapshot based on repo state.**  
> **Last Reviewed:** February 17, 2026.

## Current State (Observed in Code)

- Core screening, portfolio, and order workflows exist in the API and CLI.
- Web UI includes Dashboard, Screener, Orders, Positions, Strategy, Backtest, Daily Review, and Settings pages.
- MCP server is implemented with tool domains for portfolio, screener, strategy, config, daily review, social, and intelligence. A backtest tools domain exists as a directory but is not implemented.
- Agent integration exists and wraps MCP workflows for automation.
- Market data providers include yfinance (default) and Alpaca.
- Intelligence stack includes LLM classification and news ingestion modules. CLI classification currently uses mock news data and real ingestion is not wired into the CLI flow.
- Education and onboarding content is present in the Web UI docs and components.

## Near-Term Focus (High-Level)

1. Persistence and multi-user readiness
- Decide on SQLite vs Postgres for production
- Wire service/storage layers to the database module
- Add migrations, backup, and recovery
- Add authentication and authorization for non-local use

2. Intelligence pipeline to production
- Wire real news ingestion into the classification and daily review flows
- Add deduplication, caching, and source attribution
- Define what intelligence outputs are user-facing vs internal

3. Broker execution automation
- Add broker order submission and reconciliation
- Keep manual mode available by default
- Introduce audit logs for broker sync actions

4. Observability and reliability
- Centralized error logging and structured logs
- Health checks and failure recovery guidance
- Guardrails for long-running jobs (timeouts, retries)

## Later (Nice to Have)

- Real-time price updates and notifications
- MCP backtest tools and parity with API/UI backtest features
- Mobile UX polish and accessibility pass
- Education v2 if it aligns with product goals

## Notes

This roadmap intentionally omits refactor-level tasks that are already implemented. Detailed implementation notes live in the module-level docs and in code.
