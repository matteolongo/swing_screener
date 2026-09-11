# Changelog

All notable changes to Swing Screener are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Workspace selections now preserve row, source, run, and candidate identity across
  Today, Last Run, watchlist, and portfolio navigation; ad-hoc symbol analysis no
  longer rewrites reporting runs.

- Canonical portfolio analytics now serve persisted and browser-supplied
  snapshots with initial-risk R performance, scratch treatment, streaks,
  partial-close-aware self-sufficient journal rows/aggregates, localized
  insight codes, backend metric display statuses, and configured heat/sample
  thresholds.

- Browser-owned portfolios can apply canonical order and position lifecycle
  commands through a stateless API, with signed backend approval, isolated
  snapshot updates, and optimistic revisions.
  Commands carry explicit business timestamps, fill identity, and stop-price
  observations so retries return stable state while signed approval expiry
  remains enforced against server time.

- Screener candidates now expose a discriminated backend-owned execution
  eligibility result and, only when allowed, a canonical order draft carrying
  the validated prices, shares, R:R, quote currency, and approval identity.

- The Today page now expands a selected symbol into a decision-first workspace
  with a context-preserving symbol rail, full-screen and mobile layouts,
  canonical fundamentals, explicit evidence and intelligence actions, and
  per-source provenance, freshness, progress, degraded-input, and failure
  reporting.

### Changed

- Order review now consumes the backend execution capability and canonical draft
  directly, so blocked, incomplete, or `SKIP` candidates cannot receive a
  browser-fabricated order ticket.

- Local browser portfolios now use the stateless trading API for lifecycle
  commands and canonical position/summary metrics. Failed or conflicting
  commands preserve browser state; successful responses are stored atomically,
  with retry receipts and cross-tab command locking. Local stop updates require
  an explicit current price observation.

- Daily Review candidate plan keys are now nullable end to end, preserving
  unavailable entry, stop, share, and R:R values as explicit `null` instead of
  executable-looking zeroes.

- Report configuration now has one canonical builder, and deterministic
  confidence weights plus named signal contributions are validated and loaded
  from YAML instead of source literals.

- Reporting, selection, sizing, and execution APIs now resolve omitted configs
  at call time and share one request-scoped execution config through reporting.

- Sector concentration warnings now deduplicate tickers, use every unique
  candidate as the denominator, include exact-threshold matches, and sort all
  qualifying named sectors deterministically.

- Screener monetary fields now distinguish quote- and account-currency amounts;
  ambiguous USD aliases are deprecated and return `null` for non-USD quotes.

- Position sizing now rejects non-finite or non-positive scalar inputs and uses
  the same cent-normalized entry and stop for share count, position value, and
  reported R-risk.

- Entry signals now use explicit inclusive history windows: breakouts compare
  the current close with exactly the prior lookback, and pullback moving
  averages include exactly their configured number of closes.

- OHLCV frames are now validated and normalized once at public ingestion
  boundaries, with deterministic ascending dates, last-row duplicate-date
  handling, and explicit errors for malformed columns or missing closes.

- Screener candidates now preserve technical, confidence-prefilter, and final
  priority ranks as separate fields with deterministic ticker tie-breakers;
  legacy `rank` remains the technical-rank alias.

- Daily-review computation is now read-only; snapshot persistence uses an
  explicit atomic `POST /api/daily-review/snapshots` command, while stateless
  review screens suppress evaluation-cache and review-queue writes.

- Stateless daily reviews now use the request's position and order snapshot
  throughout pending-order and same-symbol screening instead of mixing it with
  persisted server state.

- Daily reviews now report per-position evaluation failures in a typed,
  sanitized `evaluation_errors` collection and count instead of misclassifying
  them as successful hold actions.

- Screener recommendations now fail closed when a symbol already has a pending
  entry order or when the order ledger cannot be read, and blocked candidates
  no longer receive entry approval tokens.

- Trade-plan output now keeps a stable nullable schema for populated, blocked,
  and empty results, preserving machine-readable planning block reasons.

- Screener sizing now takes account currency from application configuration and
  resolves direct or inverse FX pairs explicitly; missing conversion blocks an
  actionable cross-currency plan.

- Supported currency codes and their market-session boundaries now come from a
  single registry shared by ticker inference, screening windows, and API validation.

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

- `SKIP` execution guidance now always produces a non-actionable recommendation
  with no approval token or order draft, while token-gated pending `BUY_LIMIT`
  pullbacks retain their explicit `pending_pullback` review exception.

- Current-date final-close screens now reject market-data caches written before
  the latest active-market close and retain stale fallback provenance.
- Evaluation-cache hits now require matching candle, market-phase, strategy,
  sector-input, and schema provenance; legacy unversioned entries miss safely.
- Trade-thesis enrichment now preserves independently sourced structural and
  manual targets instead of replacing them with the desired R-multiple target.
- Waiting pullbacks with a pending `BUY_LIMIT` approval token can now enter
  manual order review without being labeled `ready`; `ready` remains reserved
  for an observed entry-trigger pass.
- The symbol workspace now distinguishes normal absence of today's analysis or
  saved evidence from provider failures, preserves cached-evidence freshness
  from the server, and explains when a newly fetched fundamentals snapshot
  contains an older reporting period.
- Screener candidates now use one gate-derived workflow status and concrete next
  action across Last Run, Today, Universe discovery, symbol details, and order
  review. Discovery rows retain their exact recommendation, malformed workflow
  pairs fail closed, and same-symbol add-ons recheck minimum R:R against the
  current live stop before remaining eligible for review.
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
