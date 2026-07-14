# Transactional Portfolio State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move orders and positions from separate JSON mutations to one migrated SQL database with atomic lifecycle operations, idempotent writes, and fail-closed legacy import.

**Architecture:** SQLAlchemy models and Alembic own the persistence schema for SQLite and PostgreSQL. Request-scoped repositories share a `PortfolioUnitOfWork`; service lifecycle methods validate and mutate inside one transaction, while startup imports the legacy JSON pair exactly once and readiness verifies migration/import state.

**Tech Stack:** SQLAlchemy 2, Alembic, psycopg 3, FastAPI, SQLite, PostgreSQL, Pydantic, pytest.

## Global Constraints

- Branch `feat/transactional-portfolio-state` starts from `feat/order-risk-approval`.
- Non-production default is `sqlite:///data/swing_screener.db`.
- Production requires `DATABASE_URL`; SQLite additionally requires `ALLOW_PRODUCTION_SQLITE=true`.
- Application startup never calls `create_all()`.
- SQLite write units use `BEGIN IMMEDIATE`; PostgreSQL lifecycle reads use `FOR UPDATE`.
- Prices and money use fixed-precision numeric columns and Decimal internally.
- Existing JSON is read once only when both tables and the import ledger are empty.
- Legacy JSON is never edited, renamed, deleted, or dual-written.
- Create/fill require `Idempotency-Key`; identical retries return the original response and conflicting reuse returns 409.

---

## File Map

**Create**

- `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`: migration runtime.
- `alembic/versions/20260715_0001_portfolio_state.py`: initial relational schema.
- `api/db/settings.py`: database URL and production validation.
- `api/db/base.py`: SQLAlchemy declarative base and naming convention.
- `api/db/models.py`: order, position, idempotency, and import ORM models.
- `api/db/session.py`: engine/session factories and dialect-aware write begin.
- `api/db/repositories.py`: session-bound order/position implementations.
- `api/db/unit_of_work.py`: transaction ownership and shared repositories.
- `api/db/legacy_models.py`: strict compatibility validation for JSON rows.
- `api/db/import_legacy.py`: checksum, state classification, and atomic importer.
- `api/db/readiness.py`: connectivity, Alembic, and import health checks.
- `api/db/__init__.py`: stable database interfaces.
- `tests/db/conftest.py`: migrated temporary SQLite fixture.
- `tests/db/test_migrations.py`: upgrade/offline DDL checks.
- `tests/db/test_legacy_import.py`: import state machine and rollback tests.
- `tests/db/test_repositories.py`: repository parity and transition tests.
- `tests/db/test_unit_of_work.py`: commit/rollback/locking tests.
- `tests/api/test_portfolio_idempotency.py`: HTTP retry contract.

**Modify**

- `pyproject.toml`, `uv.lock`: Alembic and psycopg dependencies.
- `api/repositories/orders_repo.py`, `api/repositories/positions_repo.py`: Protocol contracts; JSON implementations become import-only compatibility readers.
- `api/services/orders_service.py`: UoW and atomic create/fill/submit/cancel.
- `api/services/portfolio/write.py`, `api/services/portfolio/read.py`, `api/services/portfolio_service.py`: database repository and conditional mutations.
- `api/dependencies.py`: request-scoped sessions/UoWs.
- `api/routers/portfolio.py`: idempotency headers and authenticated subject.
- `api/main.py`, `api/monitoring.py`: startup import and database readiness.
- `scripts/migrate_json_to_sqlite.py`: replace stale deleted-module imports with importer dry-run/execute CLI.
- `Dockerfile`, `docker-compose.yml`, `Procfile`, `app.json`, `.env.example`, `api/README.md`: migration startup and operations.
- `web-ui/src/features/portfolio/api.ts`: generate/reuse idempotency keys and select API persistence in production.

---

### Task 1: Database Settings, Dependencies, and Migration Runtime

**Files:**
- Create: `api/db/settings.py`, `api/db/base.py`, Alembic runtime files.
- Modify: `pyproject.toml`, `uv.lock`.
- Create: `tests/db/test_migrations.py`.

**Interfaces:**

```python
@dataclass(frozen=True)
class DatabaseSettings:
    url: str
    app_env: Literal["development", "test", "production"]
    allow_production_sqlite: bool

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "DatabaseSettings": ...
    def validate_runtime(self) -> None: ...
```

- [ ] **Step 1: Write failing settings and migration tests**

Test development default, explicit PostgreSQL URL normalization to
`postgresql+psycopg://`, production missing URL, production SQLite rejection,
and allowed override. Run Alembic upgrade on a temporary SQLite file and compile
offline PostgreSQL SQL containing the expected four tables and constraints.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/db/test_migrations.py -q`.

- [ ] **Step 3: Add dependencies and runtime**

Add `alembic>=1.13,<2` and `psycopg[binary]>=3.2,<4`; run `uv lock`. Configure
Alembic to import only metadata/settings, use batch mode for SQLite, and read the
URL from `DatabaseSettings`. Do not import `api.main`.

- [ ] **Step 4: Run tests and confirm GREEN**

Run `uv lock --check && pytest tests/db/test_migrations.py -q`.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml uv.lock alembic.ini alembic api/db/settings.py api/db/base.py tests/db/test_migrations.py
git commit -m "Add database configuration and migrations"
```

---

### Task 2: Relational Models and Initial Revision

**Files:**
- Create: `api/db/models.py`
- Modify: `alembic/versions/20260715_0001_portfolio_state.py`
- Modify: `tests/db/test_migrations.py`

**Interfaces:**
- Produces ORM models `OrderRow`, `PositionRow`, `IdempotencyRecordRow`, `LegacyImportRow`.

- [ ] **Step 1: Write failing schema assertions**

Inspect the migrated database and assert identifiers/status/currencies/dates are
relational columns, price/money columns are `NUMERIC`, JSON audit fields exist,
order/position status checks exist, quantities are positive, source order is
unique when non-null, and idempotency uniqueness is `(operation, key)`.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/db/test_migrations.py -q`.

- [ ] **Step 3: Implement models and exact migration**

Use `Numeric(20, 8)` for prices/FX and `Numeric(20, 4)` for account money/fees.
Add integer `version` default `1` to mutable rows. Store validated flexible
fields in JSON: thesis, decision context, portfolio approval, management
settings, tags, partial closes, and idempotent response.

- [ ] **Step 4: Run upgrade/downgrade/upgrade**

Run `pytest tests/db/test_migrations.py -q` and confirm all schema checks pass
after a downgrade to base and second upgrade.

- [ ] **Step 5: Commit**

```bash
git add api/db/models.py alembic/versions/20260715_0001_portfolio_state.py tests/db/test_migrations.py
git commit -m "Define transactional portfolio schema"
```

---

### Task 3: Session-Bound Repositories and Unit of Work

**Files:**
- Create: `api/db/session.py`, `api/db/repositories.py`, `api/db/unit_of_work.py`, `tests/db/conftest.py`, `tests/db/test_repositories.py`, `tests/db/test_unit_of_work.py`.
- Modify: `api/repositories/orders_repo.py`, `api/repositories/positions_repo.py`.

**Interfaces:**

```python
class PortfolioUnitOfWork:
    orders: SqlOrdersRepository
    positions: SqlPositionsRepository
    def __enter__(self) -> "PortfolioUnitOfWork": ...
    def __exit__(self, exc_type, exc, tb) -> None: ...
    def begin_write(self) -> None: ...

class SqlOrdersRepository:
    def list_orders(self, status: str | None = None) -> tuple[list[dict], str]: ...
    def get_order(self, order_id: str, *, for_update: bool = False) -> dict | None: ...
    def add_order(self, order: Mapping[str, object]) -> dict: ...
    def transition(self, order_id: str, expected: set[str], updates: Mapping[str, object]) -> dict | None: ...

class SqlPositionsRepository:
    def list_positions(self, status: str | None = None) -> tuple[list[dict], str]: ...
    def get_position(self, position_id: str, *, for_update: bool = False) -> dict | None: ...
    def add_position(self, position: Mapping[str, object]) -> dict: ...
    def replace_position(self, position_id: str, expected_version: int, value: Mapping[str, object]) -> dict | None: ...
```

- [ ] **Step 1: Write failing repository parity tests**

Assert dictionary response shapes, Decimal-to-float boundary conversion,
validated JSON fields, status filtering, duplicate constraints, optimistic
version conflicts, commit on success, rollback on exception, and shared
visibility between repositories in one UoW.

- [ ] **Step 2: Write dialect transaction tests**

Capture SQL and assert SQLite `begin_write()` executes `BEGIN IMMEDIATE` before
reads. Compile the PostgreSQL `get_*(_, for_update=True)` statement and assert
`FOR UPDATE`.

- [ ] **Step 3: Run tests and confirm RED**

Run `pytest tests/db/test_repositories.py tests/db/test_unit_of_work.py -q`.

- [ ] **Step 4: Implement adapters and UoW**

Use one SQLAlchemy `Session` per UoW, `expire_on_commit=False`, explicit
commit/rollback, and no repository-level commits. Convert ORM rows through
named serializer/validator functions; do not expose ORM objects to services.

- [ ] **Step 5: Run tests and confirm GREEN**

Run `pytest tests/db/test_repositories.py tests/db/test_unit_of_work.py -q`.

- [ ] **Step 6: Commit**

```bash
git add api/db/session.py api/db/repositories.py api/db/unit_of_work.py api/repositories/orders_repo.py api/repositories/positions_repo.py tests/db
git commit -m "Add portfolio unit of work repositories"
```

---

### Task 4: Atomic Legacy Import State Machine

**Files:**
- Create: `api/db/legacy_models.py`, `api/db/import_legacy.py`, `tests/db/test_legacy_import.py`.
- Modify: `scripts/migrate_json_to_sqlite.py`.

**Interfaces:**

```python
class LegacyImportState(str, Enum):
    EMPTY = "empty"
    COMPLETE = "complete"
    PARTIAL = "partial"

def classify_import_state(session: Session) -> LegacyImportState: ...
def import_legacy_portfolio(uow_factory: UowFactory, orders_path: Path, positions_path: Path, schema_revision: str) -> LegacyImportReport: ...
```

- [ ] **Step 1: Write failing importer tests**

Cover empty pair import with SHA-256/count ledger, repeated no-op, empty JSON
files, invalid row rollback, duplicate source order rollback, rows without
ledger, only one populated table, and checksum change during import. Assert
source bytes are unchanged in every case.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/db/test_legacy_import.py -q`.

- [ ] **Step 3: Implement strict compatibility models and importer**

Read both files and checksums before opening the write transaction; re-read
checksums immediately before commit. Validate every row with an identifier-rich
error. Insert positions/orders and exactly one ledger row in the same UoW.
`COMPLETE` performs no source reads beyond configured-path existence checks;
`PARTIAL` raises `LegacyImportStateError` with recovery instructions.

- [ ] **Step 4: Replace stale migration script**

Implement `--database-url`, `--orders`, `--positions`, and `--dry-run`. Dry-run
validates/classifies without mutation; execute requires an Alembic-head schema
and invokes the same importer used by startup.

- [ ] **Step 5: Run tests and commit**

```bash
pytest tests/db/test_legacy_import.py -q
git add api/db/legacy_models.py api/db/import_legacy.py tests/db/test_legacy_import.py scripts/migrate_json_to_sqlite.py
git commit -m "Import legacy portfolio state atomically"
```

---

### Task 5: Atomic Order Lifecycle and Idempotency

**Files:**
- Modify: `api/services/orders_service.py`, `api/dependencies.py`, `api/routers/portfolio.py`.
- Create: `tests/api/test_portfolio_idempotency.py`.
- Modify: `tests/api/test_order_fill.py`, `tests/api/test_order_portfolio_approval.py`.

**Interfaces:**

```python
def create_order(self, request: CreateOrderRequest, *, idempotency_key: str, subject: str) -> dict: ...
def fill_order(self, order_id: str, request: FillOrderRequest, *, idempotency_key: str, subject: str) -> FillOrderResponse: ...
```

- [ ] **Step 1: Write failing HTTP idempotency tests**

Missing/blank/oversized keys return 422. Identical create and fill retries return
the original status/body and do not duplicate rows. Same key plus changed body,
subject, operation, or order ID returns 409. Hash canonical JSON containing
subject, operation, resource, and body.

- [ ] **Step 2: Write failing atomic fill tests**

Assert invalid add-on leaves order/position unchanged, two concurrent fills
produce one mutation plus one conflict, and an injected position persistence
error rolls back the order transition.

- [ ] **Step 3: Run tests and confirm RED**

Run `pytest tests/api/test_portfolio_idempotency.py tests/api/test_order_fill.py -q`.

- [ ] **Step 4: Refactor lifecycle into one write UoW**

Create reads duplicate exposure and inserts order before commit. Fill locks the
order, validates/locks add-on position, writes the position, then transitions
the order last. Reserve/store the idempotency record and response in that same
transaction. Map unique/conditional conflicts to stable 409 errors.

- [ ] **Step 5: Run tests and confirm GREEN**

Run `pytest tests/api/test_portfolio_idempotency.py tests/api/test_order_fill.py tests/api/test_order_portfolio_approval.py -q`.

- [ ] **Step 6: Commit**

```bash
git add api/services/orders_service.py api/dependencies.py api/routers/portfolio.py tests/api/test_portfolio_idempotency.py tests/api/test_order_fill.py tests/api/test_order_portfolio_approval.py
git commit -m "Make order lifecycle atomic and idempotent"
```

---

### Task 6: Conditional Position Mutations and Read Cutover

**Files:**
- Modify: `api/services/portfolio/write.py`, `api/services/portfolio/read.py`, `api/services/portfolio_service.py`, `api/dependencies.py`.
- Modify: position close/partial/stop/trail API tests.

- [ ] **Step 1: Add failing rollback and stale-version tests**

For create, stop, trail, close, and partial close, assert success increments
version once and concurrent/stale state returns 409 without overwriting the
newer row. Existing response JSON must remain unchanged except newly persisted
currency/version fields where documented.

- [ ] **Step 2: Run tests and confirm RED**

Run `pytest tests/api/test_position_close_endpoint.py tests/api/test_partial_close.py tests/api/test_trail_customization.py tests/api/test_order_stop_limit_validation.py -q`.

- [ ] **Step 3: Replace callback mutation with conditional repository methods**

Keep network price fetching outside transactions. Re-read/lock the row inside a
write UoW, repeat lifecycle invariants, calculate the new dictionary, and call
`replace_position(expected_version=...)`. Raise conflict when zero rows update.
All runtime order/position dependencies now resolve SQL repositories only.

- [ ] **Step 4: Run portfolio regressions and commit**

```bash
pytest tests/api/test_position_close_endpoint.py tests/api/test_partial_close.py tests/api/test_trail_customization.py tests/api/test_portfolio_metrics_endpoints.py tests/api/test_portfolio_summary_currency.py -q
git add api/services/portfolio api/services/portfolio_service.py api/dependencies.py tests/api
git commit -m "Cut portfolio reads and writes over to SQL"
```

---

### Task 7: Startup, Readiness, Frontend Keys, and Operations

**Files:**
- Create: `api/db/readiness.py`.
- Modify: `api/main.py`, `api/monitoring.py`, `web-ui/src/features/portfolio/api.ts` and tests.
- Modify: `Dockerfile`, `docker-compose.yml`, `Procfile`, `app.json`, `.env.example`, `api/README.md`.

- [ ] **Step 1: Write failing readiness tests**

Assert protected readiness is healthy only when connectivity, Alembic head, and
import state are complete. Unavailable DB, stale revision, and partial import
return sanitized 503 details; logs include diagnostic detail but no URL password.

- [ ] **Step 2: Write failing frontend idempotency tests**

Assert each create/fill submission creates one UUID, supplies
`Idempotency-Key`, and reuses it only when the same Promise-level submission is
retried. A new user submission receives a new UUID.

- [ ] **Step 3: Implement startup/readiness and UI headers**

Create engine/session factory during lifespan, validate schema, run importer,
and dispose on shutdown. Do not serve ready until complete. Set production
`VITE_PERSISTENCE_MODE=api`; local mode remains development-only.

- [ ] **Step 4: Wire migration commands and operator docs**

Run `alembic upgrade head` before Uvicorn in Docker/Procfile. Document backup,
first-start count/checksum verification, partial-state recovery, PostgreSQL URL,
SQLite override, and the explicit warning that rollback to JSON-writing code is
an operator decision.

- [ ] **Step 5: Run full verification**

```bash
APP_ENV=test AUTH_MODE=disabled DATABASE_URL=sqlite:////tmp/swing-screener-test.db pytest tests/api tests/db tests/test_monitoring.py -q
alembic upgrade head
alembic downgrade base
alembic upgrade head
ruff check api/db api/services/orders_service.py api/services/portfolio api/dependencies.py api/routers/portfolio.py
cd web-ui
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

When `TEST_DATABASE_URL` is set, run the repository, idempotency, and concurrent
fill tests against PostgreSQL as an additional matrix entry.

- [ ] **Step 6: Commit and review**

```bash
git add api/db api/main.py api/monitoring.py web-ui/src Dockerfile docker-compose.yml Procfile app.json .env.example api/README.md
git commit -m "Operate transactional portfolio persistence"
```

Compare `feat/order-risk-approval..HEAD`, resolve Critical/Important review
findings, rerun affected checks, and prepare a draft PR based on
`feat/order-risk-approval`.
