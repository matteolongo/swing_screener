# UI + API Refactor Plan (Feature-Based, UI-First)

> **Status: Needs review.** Validate which reorg steps have landed.  
> **Last Reviewed:** February 17, 2026.

**Status:** Proposed → In progress  
**Scope:** React UI (`web-ui/`) + API (`api/`) reorg for maintainability  
**Goal:** Reduce duplication, centralize domain logic, keep behavior unchanged.

---

## High-level goals

- Move duplicated fetch/transform logic out of pages.
- Organize UI into feature-based folders.
- Extract reusable domain services in the API.
- Introduce lightweight DI via FastAPI `Depends` (no external DI libs).
- Keep endpoints, response schemas, and behavior stable.

---

## Phase 1 — UI (feature-based, UI first)

### 1) Feature folder structure

Create `web-ui/src/features/` with feature subfolders:

- `features/portfolio/`  
  - `api.ts`  
  - `hooks.ts`  
  - `components/`  
  - `types.ts`
- `features/screener/`
- `features/backtest/`
- `features/strategy/`
- `features/social/`
- `features/config/`
- `features/shared/` (optional shared UI pieces)

### 2) Centralize API calls per feature

Each `features/*/api.ts` will:
- Call `fetch` with `apiUrl`
- Parse errors
- Transform API → camelCase types
- Return typed results

### 3) Centralize React Query hooks

Each `features/*/hooks.ts` will:
- Wrap `useQuery` / `useMutation`
- Define query keys
- Encapsulate invalidations

### 4) Move feature types

Move types from `web-ui/src/types` into feature folders.  
Keep `web-ui/src/types` as a re-export layer initially to avoid large diff.

### 5) Thin pages

Pages will:
- Call hooks
- Render components
- Avoid raw `fetch` / transformations

### 6) Update tests + MSW handlers

- Update imports to new feature modules
- Keep test behavior identical
- Ensure Vitest still passes (accept existing warnings)

---

## Phase 2 — API reorg (include models + DI)

### 1) Split API models by domain

Create `api/models/` package:
- `portfolio.py`
- `backtest.py`
- `strategy.py`
- `social.py`

Keep `api/models.py` as a **compat re-export** module.

### 2) Add repositories

Create `api/repositories/`:
- `orders_repo.py`
- `positions_repo.py`
- `strategy_repo.py`

Responsibilities:
- Read/write JSON
- No business logic

### 3) Add services

Create `api/services/`:
- `portfolio_service.py`
- `backtest_service.py`
- `screener_service.py`
- `social_service.py`
- `strategy_service.py`

Responsibilities:
- Business logic
- Validation / normalization
- Interaction with repos

### 4) Dependency injection (FastAPI `Depends`)

In `api/dependencies.py`:
- `get_orders_repo`, `get_positions_repo`, `get_strategy_repo`
- `get_portfolio_service`, `get_backtest_service`, etc.

Routers inject services via `Depends`.

### 5) Router cleanup

Routers become thin:
- Parse inputs
- Call service
- Return response models

---

## Phase 3 — Cleanup + verification

- Remove unused imports and dead helpers
- Ensure API response parity
- Run tests (UI + API)

---

## Execution order

1) UI: portfolio → orders → positions
2) UI: screener
3) UI: backtest
4) UI: strategy + social + config
5) API: models split + re-exports
6) API: repos + services + DI
7) API: router cleanup
8) Full test pass

---

## Non-goals

- No schema changes
- No endpoint changes
- No UI redesign

---

## Notes

- Keep `api/models.py` and `web-ui/src/types` as temporary re-exports until migration completes.
- DI via FastAPI `Depends` only (no external DI frameworks).
