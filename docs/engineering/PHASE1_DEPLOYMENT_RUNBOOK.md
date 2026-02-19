# Phase 1 Deployment Runbook

> **Status: Active.**  
> **Last Reviewed:** February 18, 2026.

## Goal
Deploy web + API for external testing with environment-driven configuration and health checks.

## Prerequisites
- API and web code deployed from branch `codex/phase-1-deployment-docs` (or later).
- Public API URL available (example: `https://api.example.com`).
- Public web URL available (example: `https://app.example.com`).

## API Configuration
Set these environment variables in your API hosting platform:

- `PORT`: platform-provided port (default fallback is `8000`)
- `API_HOST`: usually `0.0.0.0`
- `API_RELOAD`: `false` in deployed environments
- `API_CORS_ALLOWED_ORIGINS`: comma-separated web origins allowed to call API
  - Example: `https://app.example.com,https://staging.example.com`

Optional overrides:
- `API_CORS_ALLOWED_METHODS`
- `API_CORS_ALLOWED_HEADERS`

Template:
- `api/.env.example`

## Web Configuration
Set:

- `VITE_API_URL`: your public API base URL
  - Example: `https://api.example.com`

Template:
- `web-ui/.env.example`

## Smoke Checks (after deploy)
1. API health:
   - `GET /health` returns `200` (`healthy` or `degraded`) or `503` (`unhealthy`) with structured JSON.
2. API docs:
   - `GET /docs` loads.
3. CORS:
   - Browser call from deployed web origin reaches API without CORS rejection.
4. Core workflows:
   - Open web app.
   - Load dashboard/screener data.
   - Create/update/cancel at least one order in test data.

## Rollback
If deployment fails:
1. Revert to previous working release.
2. Reset `API_CORS_ALLOWED_ORIGINS` to known-good value.
3. Re-run smoke checks before reopening access.

## Notes
- Current persistence remains file-based (`data/*.json`), suitable for early friend testing.
- Full auth and tenant isolation are handled in later phases.
