# Changelog

All notable changes to Swing Screener are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Conditional pullback and breakout candidates now show gate-derived execution
  readiness instead of being mislabeled as failed setups in Last Run and order
  review.

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
