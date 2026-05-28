# Backend Cleanup Audit

Status: draft audit
Date: 2026-05-28

## Scope

This audit compares the current FastAPI backend against the active React UI routes:

- `/today`
- `/calendar`
- `/book`
- `/research`
- `/universes`
- `/strategy`
- `/onboarding`

It focuses on backend routes, services, API contracts, and backend-facing UI clients that are unused, stale, or low-value for the current product.

## Current Backend Surface

The active API is assembled in `api/main.py` and includes these routers:

- `calendar`: `/api/calendar/events`
- `config`: `/api/config`, `/api/config/defaults`, `/api/config/reset`
- `strategy`: `/api/strategy/*`
- `screener`: `/api/screener/run`, `/api/screener/run/{job_id}`, `/api/screener/universes`, `/api/screener/preview-order`
- `screener_history`: `/api/screener/recurrence`
- `universes`: `/api/universes/*`
- `portfolio`: `/api/portfolio/*`
- `watchlist`: `/api/watchlist/*`
- `fundamentals`: `/api/fundamentals/*`
- `intelligence`: `/api/intelligence/{ticker}`, `/api/intelligence/{ticker}/latest`, `/api/intelligence/sweep`
- `catalysts`: `/api/catalysts/*`
- `daily_review`: `/api/daily-review`, `/api/daily-review/compute`
- `weekly_reviews`: `/api/weekly-reviews/*`

The UI-facing API constants live in `web-ui/src/lib/api.ts`. Several constants describe an older API surface that is no longer registered in `api/main.py`.

## High-Confidence Cleanup Candidates

### 1. Removed DeGiro Integration Still Leaks Through The UI

Evidence:

- `api/services/fundamentals_service.py` implements `run_degiro_capability_audit()` and `run_degiro_portfolio_audit()` as hard 503 responses: "DeGiro integration has been removed."
- `web-ui/src/lib/api.ts` still defines:
  - `/api/portfolio/degiro/status`
  - `/api/portfolio/degiro/order-history`
  - `/api/portfolio/orders/{id}/fill-from-degiro`
  - `/api/portfolio/sync/degiro/apply`
  - `/api/fundamentals/degiro/portfolio-audit`
  - `/api/fundamentals/degiro/capability-audit`
- `api/routers/portfolio.py` does not define any `/degiro/*` route.
- `web-ui/src/features/portfolio/api.ts` and `web-ui/src/features/portfolio/hooks.ts` still carry DeGiro client code, but the DeGiro hooks are not used by live components.
- `pyproject.toml` still advertises optional dependency group `degiro = ["degiro-connector>=3.0.35"]`.

Recommendation:

- Remove DeGiro frontend constants, API client methods, hooks, and unused types unless a near-term DeGiro rebuild is actively planned.
- Remove the two fundamentals DeGiro routes, models, and tests if the product stance remains "integration removed."
- Remove the optional `degiro` dependency group if no supported backend path remains.
- Keep manual order and position workflows. They match the repo's non-goal: no broker automation.

Value:

- Eliminates broken UI code paths and false product affordances.
- Shrinks the backend contract around manual execution, which is the documented core workflow.

### 2. Chat API Documentation And UI Constant Are Stale

Evidence:

- `api/README.md` documents `/api/chat/answer`.
- `web-ui/src/lib/api.ts` defines `chatAnswer`.
- `api/main.py` does not import or include a chat router.
- There is no source `api/routers/chat.py`; only ignored `__pycache__` artifacts remain.

Recommendation:

- Remove `/api/chat` from `api/README.md`.
- Remove `chatAnswer` from `web-ui/src/lib/api.ts` and related mocks if they are not used.
- Keep `agent/cli.py chat` separate if CLI chat remains valuable; it should not imply an HTTP API.

Value:

- Prevents debugging time spent on an endpoint that does not exist.

### 3. Old Intelligence API Constants Do Not Match Current Backend

Evidence:

- The current backend supports only:
  - `POST /api/intelligence/{ticker}`
  - `GET /api/intelligence/{ticker}/latest`
  - `POST /api/intelligence/sweep`
- `web-ui/src/lib/api.ts` still defines unused or missing old endpoints:
  - `intelligenceConfig`
  - `intelligenceProviders`
  - `intelligenceProviderTest`
  - `intelligenceSymbolSets`
  - `intelligenceSymbolSetById`
  - `intelligenceRun`
  - `intelligenceRunStatus`
  - `intelligenceOpportunities`
  - `intelligenceEvents`
  - `intelligenceUpcomingCatalysts`
  - `intelligenceSourcesHealth`
  - `intelligenceMetrics`
  - `intelligenceEducationGenerate`
  - `intelligenceEducationBySymbol`
- The active Research/Today workspace code uses the newer symbol-analysis and sweep hooks.

Recommendation:

- Delete the unused constants and their MSW mocks.
- Keep the current symbol intelligence routes only if the UI continues showing narrative analysis.
- If old "opportunities/events/providers" functionality is still desired, write a new spec before restoring it.

Value:

- Reduces API confusion and makes the frontend contract reflect the backend that actually ships.

### 4. Portfolio Order Cancel Calls A Missing Backend Route

Evidence:

- `web-ui/src/features/portfolio/api.ts` sends `DELETE /api/portfolio/orders/{order_id}` in `cancelOrder()`.
- `api/routers/portfolio.py` currently defines order create, list local, and fill only.
- `api/repositories/orders_repo.py` has no delete/cancel helper.
- `api/README.md` claims `DELETE /api/portfolio/orders/{order_id}` exists, but it does not.

Recommendation:

- Decide explicitly:
  - If cancel pending order is a real Book workflow, add a backend route and repository method.
  - If not, remove the UI action in API mode and keep only local persistence cancellation.

Value:

- This is not just cleanup; it is a live contract bug.

### 5. Duplicate Universe Listing Routes

Evidence:

- Backend exposes both `GET /api/screener/universes` and `GET /api/universes`.
- The current UI screener client calls `/api/universes`, not `/api/screener/universes`.
- `screenerUniverses` in `web-ui/src/lib/api.ts` is unused outside its unit test.

Recommendation:

- Keep `/api/universes` as the canonical route because it also owns detail, refresh, and benchmark operations.
- Remove or deprecate `/api/screener/universes`.
- Update `api/README.md` to document only the canonical path.

Value:

- Removes duplicated concepts and makes "universe management" a single API boundary.

### 6. Screener Order Preview Looks Unused

Evidence:

- Backend route: `POST /api/screener/preview-order`.
- Frontend constant: `screenerPreview`.
- No live frontend code calls it; order previews appear to be handled through candidate view models and portfolio/order flows.

Recommendation:

- Remove the endpoint and model if no CLI/API consumer exists.
- If retained for external/manual use, move it under portfolio or document it as a developer utility, not a UI feature.

Value:

- Cuts a small but redundant risk-calculation surface.

### 7. Config Reset Is Backend-Only

Evidence:

- Backend route: `POST /api/config/reset`.
- No active UI call in `web-ui/src/features/config/api.ts`.

Recommendation:

- Keep only if intended as an admin/dev escape hatch and document it as such.
- Otherwise remove it to avoid accidental destructive config reset.

Value:

- Lowers hidden state mutation risk.

## Low-Value Or Smelly Areas To Refactor

### 1. Large Service Files Are Carrying Multiple Responsibilities

Evidence:

- `api/services/screener_service.py`: 1205 lines.
- `api/services/portfolio_service.py`: 1188 lines.
- `web-ui/src/features/portfolio/api.ts`: 716 lines.

Recommendation:

- Split by responsibility, not by technical layer:
  - screener run orchestration
  - candidate enrichment and decision summary context
  - async run job status
  - portfolio position lifecycle
  - order lifecycle
  - portfolio analytics
- Do this only around cleanup work already touching those flows.

Value:

- Makes future deletions safer and reduces regression risk.

### 2. Backend Services Instantiate Repositories Directly

Evidence:

- `api/services/portfolio_service.py` calls `ConfigRepository()` internally in multiple places instead of receiving it through dependency injection.
- This bypasses the singleton `get_config_repo()` in `api/dependencies.py`.

Recommendation:

- Inject config dependencies into `PortfolioService`.
- Remove ad hoc repository construction from service methods.

Value:

- Tests become simpler and runtime config behavior becomes more predictable.

### 3. Broad Exception Handling Hides Operational Problems

Evidence:

- Many backend services catch `Exception`, often falling back silently or returning generic errors.
- Example: `api/routers/screener.py` suppresses screener history recording failures.
- Example: data provider and calendar code often logs and continues.

Recommendation:

- Keep defensive fallbacks for external data providers.
- Replace silent internal persistence failures with structured warnings or metrics.
- Reserve catch-all exception handling for API boundaries.

Value:

- Cleanup work becomes safer because broken dependencies are visible.

### 4. Optional/Removed Dependencies Are Not Reflected In Packaging

Evidence:

- `sqlalchemy>=2.0` is a required dependency, but the database module is documented as not wired by default and no `src/swing_screener/db.py` file exists in the current tree.
- `langchain-core`, `langchain-openai`, and `langgraph` are required dependencies, but current backend intelligence code imports `openai` directly. The CLI may still need LangGraph, so this should be verified before removal.
- `degiro` optional dependency remains even though service methods now return 503.

Recommendation:

- Move dependencies behind extras when their runtime path is optional.
- Remove stale database dependency or restore the missing database module as an explicit supported path.
- Verify CLI chat before changing LangGraph-related dependencies.

Value:

- Faster installs, fewer supply-chain surfaces, clearer runtime modes.

## Keep: Backend Features That Match Current UI Value

These appear aligned with active UI workflows:

- Daily review: `/api/daily-review`, `/api/daily-review/compute`.
- Screener run and recurrence: `/api/screener/run`, `/api/screener/run/{job_id}`, `/api/screener/recurrence`.
- Universe management: `/api/universes/*`.
- Portfolio manual lifecycle: positions, orders, close, partial close, stop update, stop preview, trail method.
- Strategy CRUD and validation.
- Watchlist pipeline.
- Fundamentals config/snapshot/compare/warmup.
- Calendar events.
- Weekly reviews.
- Current intelligence routes: symbol analysis, latest cached analysis, batch sweep.
- Catalyst report routes, if Research/Today keeps catalyst context.

## Proposed Cleanup Plan

### Phase 1: Contract Corrections

Goal: remove or fix endpoints that are definitely stale or broken.

1. Remove stale UI constants for chat and old intelligence endpoints.
2. Remove `/api/chat` from `api/README.md`.
3. Fix the portfolio cancel contract:
   - either add `DELETE /api/portfolio/orders/{order_id}` with tests,
   - or remove the API-mode cancel action from the UI.
4. Remove DeGiro portfolio API client methods and hooks that are unused by live components.
5. Remove DeGiro fundamentals audit buttons/hooks if not visible, then remove backend audit routes and response models.

Tests:

- `pytest tests/api/test_* -q`
- `cd web-ui && npm run typecheck`
- `cd web-ui && npm test -- --run`

### Phase 2: Route Consolidation

Goal: make each feature have one clear backend boundary.

1. Make `/api/universes` the only universe-list route.
2. Remove or deprecate `/api/screener/universes`.
3. Remove `/api/screener/preview-order` if no active user flow depends on it.
4. Decide whether `/api/config/reset` is admin-only or removable.
5. Update `api/README.md` after route changes.

Tests:

- API endpoint tests for universes, screener, config.
- UI tests around Today and Universes pages.

### Phase 3: Service Boundary Refactor

Goal: make the backend smaller and easier to reason about without changing product behavior.

1. Split `PortfolioService` into order lifecycle, position lifecycle, and portfolio analytics units.
2. Inject `ConfigRepository` into portfolio-related services instead of constructing it directly.
3. Split `ScreenerService` enrichment helpers into focused modules:
   - run orchestration
   - candidate enrichment
   - decision summary context
   - async job status adapter
4. Keep public router response shapes unchanged during the split.

Tests:

- Existing API tests should remain green.
- Add focused unit tests for any extracted services before deleting old helper code.

### Phase 4: Dependency And Documentation Cleanup

Goal: align package dependencies and docs with supported runtime paths.

1. Remove or demote unused dependency groups:
   - `degiro` if DeGiro remains removed.
   - `sqlalchemy` if no database module is restored.
   - LangGraph/LangChain only after confirming agent CLI requirements.
2. Delete stale ignored `__pycache__` directories from local workspace if they keep misleading audits.
3. Update:
   - `api/README.md`
   - `docs/overview/INDEX.md`
   - nearest module READMEs for changed contracts.

Tests:

- `pytest -q`
- `cd web-ui && npm run typecheck && npm test -- --run`
- `uv lock` after dependency changes.

## Suggested Order

Start with Phase 1. It has the highest cleanup value because it removes broken contracts and false affordances without risky architectural changes.

Then do Phase 2 route consolidation. Only after the API surface is honest should the large service refactors begin.
