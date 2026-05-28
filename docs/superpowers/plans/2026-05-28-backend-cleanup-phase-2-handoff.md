# Backend Cleanup Phase 2 Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the next cleanup PR after Phase 1 by consolidating duplicate backend routes and removing stale frontend mock API contracts.

**Architecture:** Keep `/api/universes` as the canonical universe-management boundary. Keep `/api/screener` focused on screener runs and run status only. Remove stale test mocks that represent old backend APIs, then update docs and the cleanup roadmap in the same PR.

**Tech Stack:** FastAPI, Pydantic v2, pytest, React, TypeScript, MSW, Vitest.

---

## Current State

Phase 1 is in draft PR [#269](https://github.com/matteolongo/swing_screener/pull/269), branch `codex/phase-one-backend-cleanup`.

Before starting Phase 2:

- Confirm PR #269 is merged into `main`.
- Start a new branch from updated `main`, for example `codex/phase-two-route-consolidation`.
- Do not continue Phase 2 on `codex/phase-one-backend-cleanup` unless the user explicitly asks for stacked PRs.
- Keep unrelated untracked local files out of the PR.

Phase 1 completed:

- `DELETE /api/portfolio/orders/{order_id}` exists for API-mode pending-order cancellation.
- Removed stale DeGiro integration API contracts.
- Removed stale frontend endpoint constants for chat, old intelligence, duplicate screener universe, screener preview, and fundamentals refresh.
- Added `docs/engineering/BACKEND_CLEANUP_AUDIT.md`.
- Added `docs/engineering/BACKEND_CLEANUP_ROADMAP.md`.

Known Phase 1 residuals intentionally left for Phase 2:

- `GET /api/screener/universes` is still registered.
- `POST /api/screener/preview-order` is still registered.
- `POST /api/config/reset` still exists and needs an explicit keep/remove decision.
- Legacy intelligence and duplicate screener MSW handlers still exist in `web-ui/src/test/mocks/handlers.ts`.

## Files To Inspect First

- `api/main.py`: router registration.
- `api/routers/screener.py`: duplicate universe listing and unused order-preview route live here.
- `api/routers/universes.py`: canonical universe routes.
- `api/routers/config.py`: config reset route.
- `api/models/screener.py`: `OrderPreview` model may become unused after route removal.
- `api/services/screener_service.py`: `list_universes()` and `preview_order()` may become unused after route removal.
- `tests/api/test_screener_endpoints.py`: currently tests `/api/screener/universes`.
- `tests/api/test_config_api.py` if present, otherwise add it.
- `web-ui/src/test/mocks/handlers.ts`: remove stale MSW handlers.
- `web-ui/src/lib/api.ts` and `web-ui/src/lib/api.test.ts`: keep assertions that removed API constants stay removed.
- `api/README.md`: update route docs after removals.
- `docs/engineering/BACKEND_CLEANUP_ROADMAP.md`: mark Phase 2 complete and set the next PR.

## Task 1: Create The Phase 2 Branch

**Files:**
- No file changes.

- [ ] **Step 1: Update main after PR #269 merges**

Run:

```bash
git checkout main
git pull --ff-only origin main
```

Expected: local `main` includes Phase 1 docs and code.

- [ ] **Step 2: Create the Phase 2 branch**

Run:

```bash
git checkout -b codex/phase-two-route-consolidation
```

Expected: branch is created from updated `main`.

## Task 2: Remove Duplicate Screener Universe Route

**Files:**
- Modify: `api/routers/screener.py`
- Modify: `tests/api/test_screener_endpoints.py`
- Check: `api/routers/universes.py`

- [ ] **Step 1: Write the failing route-removal test**

In `tests/api/test_screener_endpoints.py`, replace the existing `test_list_universes_returns_metadata_objects` test with:

```python
def test_screener_universes_route_removed_in_favor_of_canonical_universes():
    client = TestClient(app)

    removed = client.get("/api/screener/universes")
    assert removed.status_code == 404

    canonical = client.get("/api/universes")
    assert canonical.status_code == 200
    body = canonical.json()
    assert isinstance(body["universes"], list)
    assert body["universes"][0]["id"]
    assert "member_count" in body["universes"][0]
    assert "exchange_mics" in body["universes"][0]
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
pytest tests/api/test_screener_endpoints.py::test_screener_universes_route_removed_in_favor_of_canonical_universes -q
```

Expected before implementation: FAIL because `/api/screener/universes` still returns 200.

- [ ] **Step 3: Remove the duplicate route**

In `api/routers/screener.py`, delete this route:

```python
@router.get("/universes")
async def list_universes(service: ScreenerService = Depends(get_screener_service)):
    """List available universe files."""
    return service.list_universes()
```

- [ ] **Step 4: Remove now-unused service helper only if no other caller remains**

Run:

```bash
rg -n "list_universes\\(" api tests src web-ui/src
```

If only `api/services/screener_service.py` defines `list_universes()`, remove that method and any import used only by it. If another current caller remains, leave the method and document the caller in the PR body.

- [ ] **Step 5: Run focused verification**

Run:

```bash
pytest tests/api/test_screener_endpoints.py::test_screener_universes_route_removed_in_favor_of_canonical_universes -q
```

Expected: PASS.

## Task 3: Remove Screener Order Preview Route

**Files:**
- Modify: `api/routers/screener.py`
- Modify: `api/models/screener.py` if `OrderPreview` becomes unused.
- Modify: `api/services/screener_service.py` if `preview_order()` becomes unused.
- Add or modify: `tests/api/test_screener_endpoints.py`

- [ ] **Step 1: Write the failing removed-route test**

Add this test to `tests/api/test_screener_endpoints.py`:

```python
def test_screener_preview_order_route_removed():
    client = TestClient(app)
    response = client.post(
        "/api/screener/preview-order",
        json={
            "ticker": "AAPL",
            "entry_price": 200,
            "stop_price": 190,
            "account_size": 50_000,
            "risk_pct": 0.01,
        },
    )

    assert response.status_code == 404
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
pytest tests/api/test_screener_endpoints.py::test_screener_preview_order_route_removed -q
```

Expected before implementation: FAIL because `/api/screener/preview-order` still returns 200.

- [ ] **Step 3: Remove the route and local request model**

In `api/routers/screener.py`, remove:

```python
import math
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
```

Replace the imports with only what remains used, typically:

```python
import os
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
```

Remove `OrderPreview` from the `api.models.screener` import list.

Delete the whole `OrderPreviewRequest` class and the whole `preview_order()` route.

- [ ] **Step 4: Remove now-unused model and service method only if no caller remains**

Run:

```bash
rg -n "OrderPreview|preview_order\\(" api tests src web-ui/src
```

If only definitions remain:

- Delete `OrderPreview` from `api/models/screener.py`.
- Delete `ScreenerService.preview_order()` from `api/services/screener_service.py`.
- Remove imports that become unused.

If a real caller remains outside the removed route, keep the model or service method and mention it in the PR body.

- [ ] **Step 5: Run focused verification**

Run:

```bash
pytest tests/api/test_screener_endpoints.py::test_screener_preview_order_route_removed -q
```

Expected: PASS.

## Task 4: Decide And Implement Config Reset Policy

**Files:**
- Modify: `api/routers/config.py`
- Add or modify: `tests/api/test_config_api.py`
- Modify: `api/README.md`

Default decision for cleanup: remove `POST /api/config/reset` because no active UI calls it and it is a hidden state mutation. If the user asks to keep it, mark it as admin/dev-only instead and add explicit documentation.

- [ ] **Step 1: Write the failing removed-route test**

If `tests/api/test_config_api.py` does not exist, create it with:

```python
from fastapi.testclient import TestClient

from api.main import app


def test_config_reset_route_removed():
    client = TestClient(app)
    response = client.post("/api/config/reset")
    assert response.status_code == 404
```

If the file already exists, add only the test function.

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
pytest tests/api/test_config_api.py::test_config_reset_route_removed -q
```

Expected before implementation: FAIL because `/api/config/reset` still returns 200.

- [ ] **Step 3: Remove the reset route**

In `api/routers/config.py`, delete:

```python
@router.post("/reset", response_model=AppConfig)
async def reset_config(repo: ConfigRepository = Depends(get_config_repo)):
    """Reset configuration to defaults."""
    return repo.reset()
```

Keep `ConfigRepository.reset()` in `api/repositories/config_repo.py` unless a wider search proves no test or CLI helper uses it.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pytest tests/api/test_config_api.py::test_config_reset_route_removed -q
```

Expected: PASS.

## Task 5: Remove Stale MSW Handlers

**Files:**
- Modify: `web-ui/src/test/mocks/handlers.ts`
- Modify: frontend tests only if they explicitly relied on stale mocks.

- [ ] **Step 1: Confirm stale handlers have no current source callers**

Run:

```bash
rg -n "api/intelligence/(config|providers|symbol-sets|run|opportunities|events|upcoming-catalysts|sources/health|metrics|education)|api/screener/universes" web-ui/src
```

Expected: matches are limited to `web-ui/src/test/mocks/handlers.ts` and comments. If a real component or hook still calls one of these routes, stop and either update that caller to the current backend API or keep the specific mock temporarily with a roadmap note.

- [ ] **Step 2: Remove stale intelligence handlers**

In `web-ui/src/test/mocks/handlers.ts`, remove handlers for:

```text
GET /api/intelligence/config
PUT /api/intelligence/config
GET /api/intelligence/providers
POST /api/intelligence/providers/test
GET /api/intelligence/symbol-sets
POST /api/intelligence/symbol-sets
PUT /api/intelligence/symbol-sets/:id
DELETE /api/intelligence/symbol-sets/:id
GET /api/intelligence/run/:jobId
GET /api/intelligence/opportunities
GET /api/intelligence/events
GET /api/intelligence/upcoming-catalysts
GET /api/intelligence/sources/health
GET /api/intelligence/metrics
GET /api/intelligence/education/:symbol
POST /api/intelligence/education/generate
```

Also remove any mock state, type imports, or helper objects that become unused after deleting those handlers.

- [ ] **Step 3: Remove duplicate screener universe mock**

In `web-ui/src/test/mocks/handlers.ts`, remove:

```typescript
http.get(`${API_BASE_URL}/api/screener/universes`, () => {
  return HttpResponse.json(mockUniverses)
}),
```

Keep:

```typescript
http.get(`${API_BASE_URL}/api/universes`, () => {
  return HttpResponse.json(mockUniverses)
}),
```

- [ ] **Step 4: Run frontend focused tests**

Run:

```bash
npm test -- --run src/lib/api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all frontend tests**

Run:

```bash
npm test -- --run
```

Expected: PASS. Existing warnings are acceptable only if they are unrelated to the removed handlers; include them in the PR body if they remain.

## Task 6: Update Docs And Roadmap

**Files:**
- Modify: `api/README.md`
- Modify: `docs/engineering/BACKEND_CLEANUP_ROADMAP.md`
- Modify: `docs/overview/INDEX.md` only if a new doc is added outside this handoff.

- [ ] **Step 1: Update API docs**

In `api/README.md`, remove these lines if present:

```text
POST /api/config/reset
GET /api/screener/universes
POST /api/screener/preview-order
```

Ensure `/api/universes` remains documented as the canonical universe-list route.

- [ ] **Step 2: Update the backend cleanup roadmap**

In `docs/engineering/BACKEND_CLEANUP_ROADMAP.md`:

- Change `## Next PR: Phase 2 Route Consolidation` to `## PR 2: Phase 2 Route Consolidation`.
- Add `Branch: codex/phase-two-route-consolidation`.
- Add a `Completed:` section with the exact removals implemented.
- Move unfinished work, if any, into `Known follow-up:`.
- Set the next PR to `Service Boundary Refactor`.

- [ ] **Step 3: Run docs diff check**

Run:

```bash
git diff -- docs/engineering/BACKEND_CLEANUP_ROADMAP.md api/README.md
```

Expected: docs describe only current registered backend routes and the next cleanup PR is clear.

## Task 7: Final Verification, Commit, Push, PR

**Files:**
- All changed files.

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
pytest tests/api/test_screener_endpoints.py tests/api/test_config_api.py -q
```

Expected: PASS.

- [ ] **Step 2: Run backend non-integration suite**

Run:

```bash
pytest -m "not integration" -q
```

Expected: PASS. Do not use full `pytest -q` as the primary gate unless live integration credentials are known to be stable; Phase 1 found live Finnhub integration tests can fail independently.

- [ ] **Step 3: Run lint on touched backend files**

Run:

```bash
ruff check api/routers/screener.py api/routers/config.py tests/api/test_screener_endpoints.py tests/api/test_config_api.py
```

Expected: PASS.

- [ ] **Step 4: Run frontend checks**

Run:

```bash
npm run typecheck
npm test -- --run
```

Expected: PASS.

- [ ] **Step 5: Check staged diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional Phase 2 files are modified or staged.

- [ ] **Step 6: Commit**

Run:

```bash
git add api/README.md api/routers/config.py api/routers/screener.py api/models/screener.py api/services/screener_service.py tests/api/test_config_api.py tests/api/test_screener_endpoints.py web-ui/src/test/mocks/handlers.ts docs/engineering/BACKEND_CLEANUP_ROADMAP.md
git commit -m "Consolidate backend route contracts"
```

If a listed file was not changed because a search proved it still has valid callers, omit that file from `git add` and explain why in the PR body.

- [ ] **Step 7: Push and open a draft PR**

Run:

```bash
git push -u origin codex/phase-two-route-consolidation
```

Open a draft PR titled:

```text
[codex] Consolidate backend route contracts
```

PR body should include:

```markdown
## Summary
- Removes duplicate `/api/screener/universes` in favor of `/api/universes`
- Removes unused `/api/screener/preview-order`
- Removes or documents `/api/config/reset` according to the chosen policy
- Removes stale MSW mocks for backend APIs that no longer exist
- Updates the backend cleanup roadmap for the next PR

## Validation
- `pytest tests/api/test_screener_endpoints.py tests/api/test_config_api.py -q`
- `pytest -m "not integration" -q`
- `ruff check ...`
- `npm run typecheck`
- `npm test -- --run`
```

## Stop Conditions

Stop and ask the user before proceeding if:

- PR #269 has not merged and the user does not want a stacked PR.
- A real UI component still calls an old intelligence endpoint.
- The user wants to keep `POST /api/config/reset`; implement it as documented admin/dev functionality instead of deleting it.
- Removing `ScreenerService.preview_order()` breaks a current non-route caller.
