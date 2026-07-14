# Backend Hardening Stacked PRs Design

**Date:** 2026-07-15
**Base branch:** `feat/intelligence-decision-workflow`
**Stack:** `feat/backend-auth-boundary` -> `feat/order-risk-approval` -> `feat/transactional-portfolio-state`

## Objective

Deliver three independently reviewable, dependent pull requests that make the
FastAPI deployment access-controlled, make entry-order approval authoritative
and currency-correct, and make order/position state transactional. The stack
must preserve the application's manual-execution boundary: it may record and
reconcile orders, but it must not submit orders to a broker.

## Approved Product Decisions

- Production authentication uses provider-neutral OpenID Connect (OIDC)
  authorization-code flow.
- Authorization is derived from configurable OIDC role/group claims. An OIDC
  identity without an allowed role is denied.
- `AUTH_MODE=disabled` is allowed only in `development` and `test`.
- Entry orders require a short-lived, server-signed candidate approval token.
- PostgreSQL and SQLite are supported through SQLAlchemy and `DATABASE_URL`.
- Existing JSON is imported once, transactionally, only into an empty database.
  The database becomes authoritative immediately; JSON remains unchanged as
  rollback evidence and is never dual-written.
- Country concentration is calculated as a share of projected open risk and is
  advisory because the existing setting is documented as a warning threshold.

## Stack Boundaries

### PR 1: `feat/backend-auth-boundary`

Base: `feat/intelligence-decision-workflow`

Owns OIDC login, session and role enforcement, CSRF protection, API rate
limiting, intelligence sweep caps, frontend authentication state, production
fail-closed configuration, and security documentation. It does not change
portfolio risk formulas or persistence.

### PR 2: `feat/order-risk-approval`

Base: `feat/backend-auth-boundary`

Owns candidate approval tokens, server-authoritative decision context,
account-currency exposure calculations, complete deterministic order gates,
and approval audit payloads. It continues to use the existing repositories and
does not introduce database persistence.

### PR 3: `feat/transactional-portfolio-state`

Base: `feat/order-risk-approval`

Owns SQLAlchemy models, Alembic migrations, JSON import, database repositories,
unit-of-work transaction boundaries, conditional lifecycle transitions,
idempotency, and database readiness. It does not change the approval policy
defined in PR 2.

## PR 1: Authentication and API Boundary

### Configuration Contract

The backend introduces a typed `AuthSettings` loader with these variables:

| Variable | Contract |
| --- | --- |
| `APP_ENV` | `development`, `test`, or `production`; default `development` |
| `AUTH_MODE` | `disabled` or `oidc`; default `oidc` in production and `disabled` elsewhere |
| `OIDC_DISCOVERY_URL` | Required in production OIDC mode |
| `OIDC_CLIENT_ID` | Required in production OIDC mode |
| `OIDC_CLIENT_SECRET` | Required in production OIDC mode |
| `OIDC_REDIRECT_URI` | Required in production; exact registered callback URL |
| `OIDC_ROLE_CLAIM` | Claim containing roles/groups; default `roles` |
| `OIDC_ADMIN_VALUES` | Comma-separated admin claim values; default `admin` |
| `OIDC_VIEWER_VALUES` | Comma-separated viewer claim values; default `viewer` |
| `SESSION_SECRET` | Required in OIDC mode; at least 32 bytes |
| `SESSION_TTL_SECONDS` | Absolute application session lifetime; default `28800` |
| `SESSION_COOKIE_SECURE` | Must be true in production |
| `AUTH_TRUST_PROXY_HEADERS` | Default false; enables trusted proxy client IP extraction |
| `RATE_LIMIT_DEFAULT_PER_MINUTE` | Default `120` |
| `RATE_LIMIT_MUTATION_PER_MINUTE` | Default `60` |
| `RATE_LIMIT_EXPENSIVE_PER_MINUTE` | Default `5` |
| `RATE_LIMIT_SWEEP_PER_MINUTE` | Default `2` |
| `RATE_LIMIT_MAX_BUCKETS` | Default `10000`; hard memory bound for active windows |
| `INTELLIGENCE_SWEEP_MAX_SYMBOLS` | Default `20`, minimum `1`, maximum `100` |

Production startup fails before serving requests when authentication is
disabled, required OIDC values are absent, the session secret is too short, or
secure cookies are disabled. `AUTH_MODE=disabled` produces a local admin
principal only when `APP_ENV` is `development` or `test`.

### Authentication Flow

The API adds:

- `GET /api/auth/login`: create state and nonce, store them in the signed
  pre-auth session, and redirect to the provider authorization endpoint.
- `GET /api/auth/callback`: validate state, exchange the code, validate the ID
  token and nonce, map configured claims to one application role, rotate the
  session, and redirect to `/`.
- `GET /api/auth/session`: return `{authenticated, user, role, csrf_token,
  expires_at}` without returning raw provider tokens.
- `POST /api/auth/logout`: require CSRF, clear the local session, and return 204.

The application session contains only subject, display/email claims, resolved
role, issued/expiry timestamps, and a cryptographically random CSRF value. The
cookie is signed, `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` in
production. A successful callback replaces the pre-auth session to prevent
session fixation. Provider access and refresh tokens are not stored in the
browser session because the application does not call provider APIs after
login.

Claim values may be a scalar or list. Matching an admin value grants `admin`;
matching only a viewer value grants `viewer`; no match returns 403 and creates
no authenticated session. Admin implicitly includes viewer permissions.

### Authorization and CSRF

The public surface is limited to static UI assets, the OIDC endpoints needed to
complete login, and `GET /health/live`, which returns only service/version
status. `/health`, `/health/ready`, `/metrics`, and all business API routes
require authentication. Production API docs are disabled unless explicitly
enabled, and enabled docs use the same session protection.

Authenticated `GET` and `HEAD` operations require viewer or admin. `POST`,
`PUT`, `PATCH`, and `DELETE` business operations require admin. Unsafe requests
also require `X-CSRF-Token` equal to the current session token. Authentication
failure returns 401, insufficient role returns 403, and CSRF failure returns
403 with stable machine-readable error codes.

OpenAPI declares an API-key cookie security scheme matching the application
session cookie and applies it to protected operations. The OIDC login and live
health operations explicitly have no security requirement.

### Rate Limiting and Cost Bounds

A bounded fixed-window limiter stores no more than a configured number of
active subject/IP buckets and removes expired buckets. Authenticated traffic is
keyed by OIDC subject. Pre-auth traffic is keyed by the directly connected
client address unless trusted proxy handling is explicitly enabled.

The default policy is 120 requests/minute, unsafe mutations are 60/minute,
screener/backtest and individual intelligence analysis are 5/minute, and an
intelligence sweep is 2/minute. Exceeding a limit returns 429 with `Retry-After`.
The current single-worker deployment makes the in-memory limiter authoritative;
a future multi-worker deployment must configure a shared limiter before raising
`WEB_CONCURRENCY`.

The sweep request model rejects more than `INTELLIGENCE_SWEEP_MAX_SYMBOLS`
symbols before launching work or spending provider/LLM resources.

### Frontend Contract

The UI adds an `AuthProvider` that calls `/api/auth/session` before rendering
business routes. OIDC mode shows a focused login action for unauthenticated
users; disabled local mode enters the application directly. The main layout
shows the current identity/role and a logout command.

All network calls use one `apiFetch` transport. It sends
`credentials: "include"`, adds the cached CSRF token to unsafe requests, and
emits one authentication-expired event on 401. Existing raw `fetch` calls are
migrated to this transport. The transport does not retry unsafe operations.

### PR 1 Acceptance Tests

- Production refuses disabled or incomplete authentication configuration.
- Development/test bypass cannot be activated when `APP_ENV=production`.
- OIDC state, nonce, issuer, audience, signature, and expiry failures create no
  application session.
- Scalar and list role claims map deterministically; unknown roles return 403.
- Viewer reads succeed and viewer mutations fail with 403.
- Admin mutations require a valid CSRF token.
- Session expiry and logout remove access.
- Rate-limit boundaries return 429 and recover after the window.
- Sweep size is rejected before analyzer construction.
- OpenAPI marks protected routes and leaves only intended public routes open.
- Frontend tests cover login gating, CSRF headers, cookie credentials, expiry,
  and logout.

## PR 2: Authoritative Risk Approval

### Signed Candidate Context

Each actionable screener candidate receives an `approval_token`. The token is a
versioned canonical JSON payload signed with HMAC-SHA256 using
`ORDER_APPROVAL_SIGNING_KEY`, which is required and at least 32 bytes in
production. Development/test may derive a separate signing key from the session
secret. The payload includes:

- version, unique token ID, issued timestamp, and expiry timestamp;
- ticker and generated order type;
- setup, trigger, and plan gate statuses;
- data status and data as-of;
- active strategy ID;
- account currency, quote currency, and quote units per one account-currency
  unit (`account_to_quote_rate`);
- target source and days to earnings;
- server-generated entry, stop, target, and a canonical plan fingerprint.

Expiry is `issued_at + ORDER_APPROVAL_TTL_SECONDS`, with a default of 28800
seconds and a production maximum of 86400 seconds. It is deliberately based on
issuance rather than the calendar value of `data_asof`, because the latest
authoritative close remains valid across weekends and exchange holidays. Only
candidates whose setup, trigger, plan, freshness, target source, earnings,
currency, and FX context are complete receive a token.

An entry-order request supplies the token instead of client-authored decision
claims. Verification checks signature, version, expiry, ticker, and current
active strategy. The verified values are the only decision/currency inputs used
by approval. Missing, altered, expired, or strategy-stale tokens fail with 422.
Protective/non-entry orders are outside this token requirement.

Quantity, entry, stop, and target remain editable. Their coherence and every
financial limit are recomputed from the submitted values; the original plan
fingerprint is retained for audit comparison and does not silently overwrite
the user's submitted plan.

### Canonical Exposure Model

The conversion convention is fixed: `account_to_quote_rate` is quote-currency
units per one account-currency unit. Quote amounts convert to account currency
by division. Same-currency exposure always uses rate `1.0` and ignores supplied
FX values.

An `ExposureSnapshot` normalizes all open positions, pending/submitted entry
orders, and the proposed order into account currency. Newly created orders and
positions persist quote currency and entry approval/fill FX. For legacy rows,
quote currency may be inferred from the instrument master/ticker; cross-currency
rows without a positive persisted FX rate make approval fail closed with
`FX_CONTEXT_MISSING` rather than being counted at identity.

The effective policy combines the active strategy's account size, trade risk,
position cap, reward/risk, commission, and fee limit with application-level
account currency, heat limit, and concentration warning threshold. The policy
schema gains an explicit `max_portfolio_heat_pct`; its default is `0.06`.

### Deterministic Gates

For proposed quantity `q`, entry `e`, stop `s`, target `t`, and conversion rate
`fx`:

- proposed notional = `q * e / fx`;
- price risk = `q * (e - s) / fx`;
- estimated round-trip fees use the configured commission percentage and are
  converted into account currency;
- planned risk = price risk plus estimated fees;
- reward/risk = `(t - e) / (e - s)` before fees, matching the strategy's
  structural price-plan definition.

Approval hard-blocks when any of these fail:

- signed setup, trigger, plan, freshness, strategy, target-source, or earnings
  permission;
- finite long-plan ordering `stop < entry < target`;
- minimum reward/risk;
- planned risk <= `account_size * risk_pct`;
- same-symbol projected notional <= `account_size * max_position_pct`;
- projected total open/pending notional <= account size;
- projected portfolio heat <= `account_size * max_portfolio_heat_pct`;
- estimated fees / price risk <= `max_fee_risk_pct`;
- complete currency/FX context for every included exposure.

Country concentration is `(country projected risk / total projected open risk)
* 100`. At or above `max_concentration_pct` it returns `WARN`, not `BLOCK`, and
does not change the boolean approval result. `PortfolioApprovalGate.status`
therefore becomes `PASS | WARN | BLOCK`.

### Approval Audit Record

An approved order persists the token ID/fingerprint, verified decision context,
policy version, complete policy values, currencies and FX, estimated fees,
current and projected exposure totals, and every gate's status/current/projected
/limit/explanation. It never persists the raw signing key or provider tokens.

### PR 2 Acceptance Tests

- Token payload or signature tampering, expiry, ticker mismatch, and active
  strategy changes block entry creation.
- Client decision fields cannot override signed context.
- A trade above `risk_pct` or `max_position_pct` blocks.
- Cash, heat, minimum reward/risk, fee ratio, and earnings limits each block
  independently.
- Same-currency exposure uses identity even when an FX value is supplied.
- Mixed-currency open/pending/proposed exposure is normalized correctly.
- Missing legacy cross-currency FX blocks rather than undercounting.
- Concentration is risk-based, produces `WARN`, and does not block an otherwise
  valid first position.
- Adjusted order quantity/prices are evaluated rather than replaced.
- The persisted approval record is sufficient to reproduce every gate.

## PR 3: Transactional Portfolio State

### Database Configuration and Migrations

`DATABASE_URL` selects the backend. When absent outside production it resolves
to `sqlite:///data/swing_screener.db`. PostgreSQL URLs use the psycopg 3 driver.
Production requires an explicit `DATABASE_URL`; production SQLite is rejected
unless `ALLOW_PRODUCTION_SQLITE=true` is explicitly set.

Alembic owns schema revisions. Docker and deployment startup scripts run
`alembic upgrade head` before Uvicorn. Direct startup against a missing or old
schema fails readiness with a migration command rather than calling
`create_all()` implicitly.

### Relational Schema

`orders` stores the order ID, lifecycle status, ticker, kind/type, quantity,
entry/stop/target/fill prices, dates, position relationship, currencies, FX,
fees, idempotency key/request hash, timestamps, thesis/notes, decision context,
and portfolio approval. `positions` stores the position ID, unique source order
ID, lifecycle status, ticker, shares, entry/stop/target/current/exit prices,
dates, currencies, FX, fees, broker identifiers, management settings,
timestamps, thesis/lesson/notes, tags, and partial closes.

Identifiers, lifecycle fields, dates, prices, quantities, currencies, and
foreign-key relationships use relational columns. Prices and monetary values
use fixed-precision numeric columns. Flexible structured audit fields use JSON
columns with explicit Pydantic validation at repository boundaries. Existing
API responses continue to expose JSON-compatible floats and dictionaries.

A `legacy_imports` ledger records source paths, SHA-256 checksums, row counts,
import timestamp, and schema revision. Database constraints include unique
order/position IDs, unique non-null position `source_order_id`, unique
idempotency keys within an operation type, valid lifecycle-status checks, and
positive quantity/share checks.

### Repository and Unit of Work

Database repositories retain the service-facing dictionary/Pydantic contracts
needed by the current services but require a SQLAlchemy session. A
`PortfolioUnitOfWork` creates one session and exposes order and position
repositories sharing that transaction. It commits only on successful context
exit and rolls back on every exception.

All runtime order and position reads and writes move to these repositories.
Other JSON-backed domains remain unchanged. No order or position mutation
writes the legacy JSON files after cutover.

### Atomic Lifecycle Operations

Order creation checks duplicate pending entries and inserts the order inside
one write transaction. Fill processing locks/selects the pending or submitted
order, validates the complete new-position or add-on mutation, writes the
position, changes the order to filled last, and commits once. Any validation,
constraint, or persistence error leaves both records unchanged.

PostgreSQL uses `SELECT ... FOR UPDATE`. SQLite write units begin with
`BEGIN IMMEDIATE` so two processes cannot both validate the same pre-transition
state. Submit, cancel, close, partial-close, and stop mutations use conditional
status/version updates rather than read-then-unconditional-write behavior.

`POST /api/portfolio/orders` and
`POST /api/portfolio/orders/{order_id}/fill` require `Idempotency-Key`. The
stored request hash covers the authenticated subject, operation, resource, and
canonical request body. Repeating an identical operation returns the original
result; reusing a key with a different hash returns 409. The frontend generates
one UUID per submission attempt and reuses it only for transport retries.

### One-Time JSON Import

After migrations, startup runs an importer in one transaction. If orders,
positions, and the import ledger are all empty, it reads the configured JSON
files, validates every row with the compatibility models, inserts both domains,
records checksums/counts, and commits. A validation failure rolls back all
inserts and reports the exact file, record identifier, and field without
including secrets.

When the ledger exists, startup verifies that the database is already
authoritative and performs no import. Rows without a ledger, only one populated
table, changed JSON during an in-progress import, or any other partial state
cause startup/readiness failure with recovery instructions. The importer never
edits, renames, or deletes JSON.

### Readiness and Recovery

`/health/ready` verifies database connectivity, current Alembic revision, and
completed/non-ambiguous legacy import. It returns sanitized 503 responses for
unavailable, stale-schema, or partial-import states. Detailed diagnostics are
logged with a request/startup correlation ID and are visible only to admins.

Backup/rollback before the first database mutation consists of the untouched
JSON files plus the database backup. Rolling application code back to a
JSON-writing version requires an explicit operator decision because dual write
is intentionally unsupported.

### PR 3 Acceptance Tests

- Alembic upgrades an empty SQLite database to head and emits PostgreSQL-valid
  DDL in offline mode.
- Empty-database JSON import is atomic and records checksums/counts.
- Repeated startup does not duplicate data.
- Invalid rows and partial database states roll back/fail closed.
- Existing portfolio/order API response shapes remain compatible.
- Invalid add-on fill leaves both order and position unchanged.
- Concurrent fill attempts create one position mutation and one conflict.
- Identical idempotent retries return the original result; conflicting reuse
  returns 409.
- Conditional submit/cancel/close transitions cannot overwrite a newer state.
- Database unavailability and stale migrations produce not-ready status.
- An optional integration suite runs the same repository and concurrency
  contract against `TEST_DATABASE_URL` when PostgreSQL is available.

## Rollout Order

1. Deploy PR 1 configuration with OIDC credentials, claim mappings, secure
   session secret, and explicit production environment. Validate viewer/admin
   access before enabling public traffic.
2. Merge/deploy PR 2 with the approval signing key. Existing clients must adopt
   candidate tokens before entry creation is enabled.
3. Back up JSON, provision `DATABASE_URL`, run Alembic, start PR 3 once to import,
   verify counts/checksums/readiness, and then allow mutations.

Each PR is a draft until its focused tests, the backend/API suite, frontend
tests affected by its contract, Ruff on changed Python files, and TypeScript
checks pass. PR 2 must not merge before PR 1; PR 3 must not merge before PR 2.

## Non-Goals

- Broker order submission or automatic execution.
- Refresh-token storage or calling identity-provider APIs after login.
- Multi-tenant portfolio ownership; the role model controls one application
  portfolio in this stack.
- A shared/distributed rate-limit store while production remains one worker.
- Migrating non-portfolio JSON domains.
- Dual writing database and JSON state.
