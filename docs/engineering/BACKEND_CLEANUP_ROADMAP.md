# Backend Cleanup Roadmap

Status: active
Started: 2026-05-28

## PR 1: Phase 1 Contract Corrections

Branch: `codex/phase-one-backend-cleanup`

Completed:

- Added a real API-mode pending-order cancel contract:
  - `DELETE /api/portfolio/orders/{order_id}`
  - `OrdersRepository.cancel_order()`
  - `PortfolioService.cancel_order()`
- Removed removed/stale DeGiro HTTP API surface:
  - deleted fundamentals DeGiro audit routes
  - deleted DeGiro audit service stubs
  - deleted DeGiro API response/request models that no registered route used
  - removed stale DeGiro frontend API clients, hooks, types, query keys, and endpoint constants
  - removed the `degiro` optional dependency group and refreshed `uv.lock`
- Removed stale frontend endpoint constants for:
  - chat HTTP API
  - old intelligence config/provider/symbol-set/run/opportunity/event/education APIs
  - duplicate screener universe endpoint
  - unused screener order-preview endpoint
  - unused fundamentals refresh endpoint constant
- Updated `api/README.md` so it reflects the current registered API surface.
- Added/updated tests for:
  - API-mode order cancellation
  - removed DeGiro fundamentals endpoints no longer routing to the old 503 service stubs
  - frontend API constants no longer exposing removed backend contracts
- Added the backend cleanup audit to `docs/overview/INDEX.md`.

Known follow-up:

- Legacy intelligence MSW handlers still exist in `web-ui/src/test/mocks/handlers.ts`; they are no longer exposed through public API constants, but can be removed in the route-consolidation PR after checking older tests.
- UI copy still mentions DeGiro as manual broker guidance. This PR removes DeGiro integration/API contracts, not broker-specific educational copy.

## PR 2: Phase 2 Route Consolidation

Branch: `codex/phase-one-backend-cleanup`

Completed:

- Made `/api/universes` the only universe-list route.
- Removed `GET /api/screener/universes` (duplicate).
- Removed `POST /api/screener/preview-order`.
- Removed `POST /api/config/reset`.
- Removed legacy intelligence MSW mock handlers from `web-ui/src/test/mocks/handlers.ts`.
- Updated `api/README.md` to reflect current registered API surface.

Known follow-up:

- Screener stale MSW handlers may need further cleanup if additional tests reference them.

## Next PR: Service Boundary Refactor

Planned:

- Split `PortfolioService` into focused units for:
  - order lifecycle
  - position lifecycle
  - portfolio analytics
- Inject config dependencies into portfolio services instead of constructing `ConfigRepository()` internally.
- Split `ScreenerService` into focused modules for:
  - run orchestration
  - candidate enrichment
  - decision-summary context
  - async job status adaptation

## Later PR: Dependency And Documentation Cleanup

Planned:

- Revisit required dependency groups:
  - verify whether `sqlalchemy` is still required while the database path remains unwired
  - verify whether LangGraph/LangChain are CLI-only and should move behind an extra
- Remove misleading local `__pycache__` artifacts from working copies where they confuse audits.
- Keep `docs/overview/INDEX.md`, `api/README.md`, and module READMEs aligned with each cleanup PR.
