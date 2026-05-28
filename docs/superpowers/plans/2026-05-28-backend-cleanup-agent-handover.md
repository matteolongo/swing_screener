# Backend Cleanup Agent Handover

Date: 2026-05-28

## User Instruction To Preserve

The user wants backend cleanup PRs that:

- Match backend routes, services, and dependencies to the actual UI features.
- Remove APIs, services, dependencies, and frontend clients/mocks that are unused or do not add product value.
- Keep a roadmap file updated after each PR so the next agent knows what is done and what is still missing.
- Create a PR for each cleanup phase.
- Leave a handover for the next agent before stopping.

## Current PR Context

Current branch: `codex/phase-one-backend-cleanup`

Current draft PR: https://github.com/matteolongo/swing_screener/pull/269

This PR implements Phase 1 and now also contains the handover files for Phase 2. The next agent should not continue implementation on this branch after PR #269 is merged unless the user explicitly asks for stacked PRs.

## Reference Plans And Docs

Read these in order:

1. `docs/engineering/BACKEND_CLEANUP_AUDIT.md`
   - Original backend/UI mismatch audit.
   - Explains why each cleanup candidate was selected.

2. `docs/engineering/BACKEND_CLEANUP_ROADMAP.md`
   - Durable progress tracker.
   - Must be updated in every cleanup PR before opening the next PR.

3. `docs/superpowers/plans/2026-05-28-backend-cleanup-phase-2-handoff.md`
   - Executable implementation plan for the next missing PR.
   - Contains exact files, tests, commands, expected failures, and PR body.

## What Is Already Done In Phase 1

The Phase 1 PR completed these changes:

- Added real pending-order cancel support in API mode:
  - `DELETE /api/portfolio/orders/{order_id}`
  - `OrdersRepository.cancel_order()`
  - `PortfolioService.cancel_order()`
- Removed stale DeGiro backend and frontend API contracts.
- Removed the optional `degiro` dependency group and refreshed `uv.lock`.
- Removed stale frontend endpoint constants for:
  - chat HTTP API
  - old intelligence config/provider/symbol-set/run/opportunity/event/education APIs
  - duplicate screener universe endpoint constant
  - unused screener order-preview endpoint constant
  - unused fundamentals refresh endpoint constant
- Updated `api/README.md`.
- Added tests for the removed API contracts and pending-order cancellation.

## What Is Still Missing

The next PR is Phase 2: route consolidation and stale mock cleanup.

Implement these missing items:

1. Remove `GET /api/screener/universes`.
   - `/api/universes` is the canonical route.
   - Update backend endpoint tests so `/api/screener/universes` returns 404 and `/api/universes` still returns metadata.

2. Remove `POST /api/screener/preview-order`.
   - No active UI client uses it after Phase 1.
   - Remove `OrderPreview`, `OrderPreviewRequest`, and `ScreenerService.preview_order()` only after `rg` proves no real callers remain.

3. Decide and implement the `POST /api/config/reset` policy.
   - Default cleanup decision: remove it because no active UI calls it and it is a hidden state mutation.
   - If the user wants to keep it, document it explicitly as admin/dev-only instead.

4. Remove stale MSW handlers from `web-ui/src/test/mocks/handlers.ts`.
   - Remove old intelligence handlers that no longer match the backend.
   - Remove duplicate `/api/screener/universes` mock.
   - Keep current `/api/intelligence/{ticker}`, `/api/intelligence/{ticker}/latest`, `/api/intelligence/sweep`, and `/api/universes` mocks.

5. Update docs and roadmap.
   - `api/README.md` must reflect the registered routes after Phase 2.
   - `docs/engineering/BACKEND_CLEANUP_ROADMAP.md` must mark Phase 2 complete and name the next PR.

## Required Workflow For The Next Agent

Use these skills/workflows:

- `superpowers:using-git-worktrees` before starting implementation work.
- `superpowers:test-driven-development` for route removals and contract changes.
- `superpowers:verification-before-completion` before claiming completion, committing, pushing, or opening a PR.
- `github:yeet` when publishing the cleanup PR.

Branching:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b codex/phase-two-route-consolidation
```

Only do this after PR #269 is merged into `main`.

## Validation Expected For Phase 2

Run these before opening the PR:

```bash
pytest tests/api/test_screener_endpoints.py tests/api/test_config_api.py -q
pytest -m "not integration" -q
ruff check api/routers/screener.py api/routers/config.py tests/api/test_screener_endpoints.py tests/api/test_config_api.py
npm run typecheck
npm test -- --run
git diff --check
```

Do not use full `pytest -q` as the only required gate unless live integration credentials are stable. Phase 1 found live Finnhub integration tests can fail independently of cleanup changes.

## Stop Conditions

Stop and ask the user if:

- PR #269 is not merged and the user does not want a stacked PR.
- Any current UI component or hook still calls an old intelligence endpoint.
- The user wants to preserve `POST /api/config/reset`.
- A non-route caller still uses `ScreenerService.preview_order()` or `OrderPreview`.
- Removing stale MSW handlers causes real current UI tests to fail for product behavior, not just outdated mocks.

## Expected PR Outcome

Open a draft PR titled:

```text
[codex] Consolidate backend route contracts
```

The PR should remove duplicate or stale route contracts, update tests/docs, and update `docs/engineering/BACKEND_CLEANUP_ROADMAP.md` with Phase 2 completion plus the next cleanup phase.
