# Changelog

All notable changes to Swing Screener are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The Today page now expands a selected symbol into a decision-first workspace
  with a context-preserving symbol rail, full-screen and mobile layouts,
  canonical fundamentals, explicit evidence and intelligence actions, and
  per-source provenance, freshness, progress, degraded-input, and failure
  reporting.

### Changed

- The symbol workspace header now exposes symbol context, screener close status,
  aggregate source health, and a non-intelligence bulk refresh; candle-provider
  failures are retryable errors rather than empty successful histories.

- Portfolio position/order workspace freshness is now derived by the API from
  persisted ledger dates and the YAML-backed staleness policy, rather than from
  browser cache timing.

- Expanded Today, Last Run, and Watchlist views now render a compact symbol rail
  from their existing mounted data owner, preserving tab and filter state when
  the full panel is restored.

- Symbol analysis now follows an answer, evidence, trust, and detail hierarchy
  across Overview, Fundamentals, News & Intelligence, actions, and Volume
  Zones while preserving the existing Backtest workflow.

### Fixed

- The symbol workspace now distinguishes normal absence of today's analysis or
  saved evidence from provider failures, preserves cached-evidence freshness
  from the server, and explains when a newly fetched fundamentals snapshot
  contains an older reporting period.
- Screener candidates now use one gate-derived workflow status and concrete next
  action across Last Run, Today, symbol details, and order review, preventing an
  analytical `Buy on Pullback` opinion from appearing beside `No valid setup`.
- Applied universe refreshes now persist review metadata when index membership is
  unchanged, preventing verified snapshots from expiring immediately afterward.
- Volume Zones now preserves available candle or analysis content during partial
  failures, rejects mismatched response and parameter identities, reports each
  source's provenance without conflating candle and fetch times, and offers
  source-specific retries.
- Workspace refresh and intelligence activity now keeps a bounded request-ID
  history, records late selection callbacks as discarded, and announces each
  new failure once while retaining status history for review.
- Evidence refreshes now use UTC cache dates and atomic writes, preserve usable
  cached items through provider failures, and reject future-dated cache entries
  as stale.

## [3.0.0] - Unreleased

### Added

- Deterministic intelligence decision gates and a pinned `Today` screener source.
- Provider-neutral OIDC authentication, signed sessions, role enforcement, CSRF
  protection, rate-limit policies, and an authenticated web bootstrap.
- Server-authoritative order approval that recomputes risk, currency, FX,
  strategy, fee, cash, exposure, and portfolio constraints.
- SQLAlchemy-backed transactional orders and positions, Alembic migrations,
  idempotent request handling, and one-time legacy JSON import.

### Changed

- Position mutations retain idempotency keys across frontend retries.
- The legacy importer serializes concurrent startups and converts signed broker
  fee debits to canonical positive fee amounts without modifying source JSON.
- `postgres://` and `postgresql://` database URLs normalize to the psycopg
  SQLAlchemy dialect, and readiness checks cover database and frozen legacy
  state.

### Fixed

- Local Docker startup imports historical signed DeGiro exit fees safely.
- API, OpenAPI, Python package, and web package metadata consistently report
  `3.0.0`.

### Security

- Production authentication and configuration fail closed when signing, cookie,
  CORS, proxy, or authorization requirements are unsafe.
