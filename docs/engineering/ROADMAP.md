# Swing Screener - Roadmap

> **Status: Current snapshot based on repo state.**  
> **Last Reviewed:** March 17, 2026.

## Current State (Observed in Code)

- Core screening, portfolio, and order workflows exist in the API and CLI.
- Web UI includes Workspace, Daily Review, and Strategy pages for the current workflow.
- MCP server is implemented with tool domains for portfolio, screener, strategy, config, daily review, and intelligence.
- Agent integration is MCP-first and is now the canonical AI/tooling runtime.
- Workspace chat and agent chat now share the same MCP-backed backend path.
- Market data providers include yfinance (default) and Alpaca.
- Intelligence stack includes event ingestion, optional LLM classification, education generation, and shared provider configuration.
- Education and onboarding content is present in the Web UI docs and components.

## Near-Term Focus (High-Level)

1. Persistence and multi-user readiness
- Decide on SQLite vs Postgres for production
- Wire service/storage layers to the database module
- Add migrations, backup, and recovery
- Add authentication and authorization for non-local use

2. Intelligence pipeline to production
- Improve ingestion quality, coverage, and source attribution in the intelligence flows
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
- Additional MCP tool parity for newly introduced UI/API workflows
- Mobile UX polish and accessibility pass
- Education v2 if it aligns with product goals

## Notes

This roadmap intentionally omits refactor-level tasks that are already implemented. Detailed implementation notes live in the module-level docs and in code.
