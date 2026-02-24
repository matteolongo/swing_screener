# Module Architecture Migration Plan

Last updated: 2026-02-24

## Scope
This plan simplifies the `src/swing_screener` architecture while keeping API and frontend behavior stable.

### In scope
- Consolidate and clarify module boundaries.
- Remove cyclic dependencies.
- Reduce duplicated logic across strategy/reporting/selection/risk domains.
- Keep existing FastAPI endpoints stable during migration.
- Keep frontend behavior and UX stable during migration.

### Out of scope
- `backtest` domain (explicitly excluded).
- Product-level feature changes unrelated to architecture.

## Current Pain Points
1. `reporting <-> strategies` cycle adds coupling and makes testing harder.
2. `execution <-> portfolio` coupling leaks state/transition concerns across boundaries.
3. `strategy` and `strategies` split is semantically confusing.
4. `screeners` and `signals` are small and tightly coupled, but split.
5. `recommendations` is effectively risk decision logic but isolated as a top-level domain.

## Target Architecture (End State)

### Top-level domains after migration
- `data`
- `intelligence`
- `social`
- `risk` (includes recommendations)
- `portfolio`
- `execution`
- `strategy` (merged with current `strategies`)
- `selection` (merged from `screeners` + `signals`)
- `reporting` (pure presentation/contracts, no strategy registry orchestration)
- `utils`

### Key design rules
1. Strategy modules orchestrate selection/risk/execution inputs and produce report-ready payloads.
2. Reporting only formats/presents payloads; it does not resolve strategy modules.
3. Selection owns universe filtering + ranking + entry-signal generation.
4. Risk owns recommendation/thesis and risk decision policy.
5. Portfolio owns position state; execution owns order state and transitions.
6. Shared order/position transition primitives live in a dedicated shared submodule, not cross-domain imports.

## Migration Mapping
| Current module | Target module/path | Transition strategy | API impact | Frontend impact |
|---|---|---|---|---|
| `strategies/*` | `strategy/modules/*` | keep `strategies` re-export shim for 1-2 phases | none expected | none expected |
| `strategy/*` | `strategy/*` (expanded) | move files incrementally | none expected | none expected |
| `screeners/*` | `selection/{universe,ranking}.py` | keep `screeners` shim until phase 7 | none expected | none expected |
| `signals/*` | `selection/entries.py` | keep `signals` shim until phase 7 | none expected | none expected |
| `recommendations/*` | `risk/recommendations/*` | keep `recommendations` shim until phase 7 | possible nested payload drift risk | verify recommendation consumers |
| `reporting/report.py` orchestration | strategy service layer | add wrapper then remove | none expected if payload stable | none expected |
| cross-cutting position/order transforms | shared transition module | introduce new module and migrate call sites | none expected | none expected |

## API and Frontend Compatibility Policy

### API policy
1. Keep existing endpoints and response contracts stable until final cleanup phase.
2. Use internal adapter shims when module paths move.
3. If payload fields must change, add additive fields first, then deprecate old fields after frontend rollout.
4. Do not rename route paths during this migration unless explicitly planned in a versioned API step.

### Frontend policy
1. Keep `web-ui/src/lib/api.ts` endpoint map unchanged during core refactors.
2. Keep feature API clients (`web-ui/src/features/*/api.ts`) stable; only update parsing/types if payloads change.
3. Maintain query key stability in `web-ui/src/lib/queryKeys.ts` unless an intentional cache-busting migration is documented.
4. Use feature-level contract tests and MSW mocks to verify no regressions in `DailyReview`, `Workspace`, `Strategy` flows.

## Affected Surface Matrix
| Concern | Primary API files | Primary frontend files |
|---|---|---|
| Strategy lifecycle | `api/routers/strategy.py`, `api/services/strategy_service.py`, `api/repositories/strategy_repo.py` | `web-ui/src/features/strategy/api.ts`, `web-ui/src/features/strategy/hooks.ts`, `web-ui/src/pages/Strategy.tsx` |
| Screener pipeline | `api/routers/screener.py`, `api/services/screener_service.py` | `web-ui/src/features/screener/api.ts`, `web-ui/src/features/screener/hooks.ts`, `web-ui/src/pages/Workspace.tsx` |
| Portfolio + orders | `api/routers/portfolio.py`, `api/services/portfolio_service.py` | `web-ui/src/features/portfolio/api.ts`, `web-ui/src/features/portfolio/hooks.ts`, `web-ui/src/pages/Workspace.tsx` |
| Daily review | `api/routers/daily_review.py`, `api/services/daily_review_service.py` | `web-ui/src/features/dailyReview/api.ts`, `web-ui/src/pages/DailyReview.tsx` |
| Social | `api/routers/social.py`, `api/services/social_service.py` | `web-ui/src/features/social/api.ts`, `web-ui/src/types/social.ts` |
| Intelligence | `api/routers/intelligence.py`, `api/services/intelligence_service.py` | `web-ui/src/features/intelligence/api.ts`, `web-ui/src/features/intelligence/hooks.ts`, `web-ui/src/pages/DailyReview.tsx` |

## Phase Plan

## Phase 0: Baseline and Safety Nets
Objective: Freeze current behavior and create migration guardrails.

### Backend tasks
1. Add/refresh architecture smoke tests for core flows:
- strategy load + validate
- screener run
- portfolio summary/orders/positions endpoints
- social analyze
- intelligence run lifecycle
2. Add import-layer tests to detect forbidden dependency directions (lightweight architecture tests).

### API tasks
1. Snapshot OpenAPI schema (`/openapi.json`) and store as baseline artifact.
2. Add response snapshot tests for high-traffic routes:
- `/api/screener/run`
- `/api/portfolio/*`
- `/api/strategy/*`
- `/api/daily-review`

### Frontend tasks
1. Freeze baseline with existing page-level tests:
- `web-ui/src/pages/DailyReview.test.tsx`
- `web-ui/src/pages/Workspace.test.tsx`
- `web-ui/src/pages/Strategy.test.tsx`
2. Add one end-to-end smoke flow (or equivalent integration harness) covering strategy -> screener -> portfolio read paths.

### Exit criteria
- OpenAPI and response baselines committed.
- Baseline tests green.

## Phase 1: Break `reporting <-> strategies` Cycle
Objective: Make reporting pure and strategy-driven orchestration explicit.

### Backend tasks
1. Move strategy resolution/orchestration out of `reporting/report.py` into strategy layer service.
2. Refactor `reporting` to accept already-computed report payloads/config only.
3. Keep compatibility wrapper in old function signatures for one phase.

### API tasks
1. Ensure daily review and screener services call new strategy orchestration entry point.
2. Keep response models unchanged in:
- `api/models/daily_review.py`
- `api/models/screener.py`

### Frontend tasks
1. No endpoint changes expected.
2. Re-run daily review/workspace snapshot tests and verify identical rendering.

### Exit criteria
- No `reporting -> strategies` imports remain.
- Existing API contracts unchanged.

## Phase 2: Merge `strategy` + `strategies`
Objective: One cohesive strategy domain.

### Backend tasks
1. Create new unified layout under `src/swing_screener/strategy/`:
- `strategy/modules/*` (current strategy implementations)
- `strategy/registry.py`
- `strategy/config.py`
- `strategy/storage.py`
2. Move current `strategies/*` into `strategy/modules/*`.
3. Keep temporary import re-exports in `strategies/__init__.py` for compatibility.
4. Update internal imports incrementally (no big bang).

### API tasks
1. Update API services to import from unified `strategy` package.
2. Verify `api/routers/strategy.py` behavior parity.

### Frontend tasks
1. No endpoint changes expected.
2. Re-run strategy editor hooks/tests:
- `web-ui/src/features/strategy/useStrategyEditor.test.tsx`
- `web-ui/src/features/strategy/useStrategyReadiness.test.ts`

### Exit criteria
- All runtime imports use `swing_screener.strategy.*`.
- `strategies` package only remains as temporary compatibility shim.

## Phase 3: Merge `screeners` + `signals` into `selection`
Objective: Unify candidate selection pipeline.

### Backend tasks
1. Introduce `src/swing_screener/selection/` with submodules:
- `universe.py` (from screeners)
- `ranking.py` (from screeners)
- `entries.py` (from signals)
- `pipeline.py` (new orchestration helper)
2. Add compatibility imports in old modules (`screeners`, `signals`) during transition.
3. Update strategy flow to call selection pipeline entry points.

### API tasks
1. Keep `/api/screener/*` route contracts unchanged.
2. Refactor `api/services/screener_service.py` internals only.

### Frontend tasks
1. No API surface changes expected.
2. Verify screener feature behavior/tests:
- `web-ui/src/features/screener/*`
- workspace page tests consuming screener responses.

### Exit criteria
- Selection flow is imported from `selection` internally.
- Legacy `screeners`/`signals` paths only used as shims.

## Phase 4: Move `recommendations` under `risk`
Objective: Align recommendation logic with risk decision domain.

### Backend tasks
1. Create `src/swing_screener/risk/recommendations/` and move:
- recommendation engine
- thesis logic
2. Keep temporary re-exports from old `recommendations` module.
3. Update `risk/engine.py` and related call sites to new paths.

### API tasks
1. Validate portfolio/screener response payload parity where recommendation fields appear.
2. Keep Pydantic response models stable in:
- `api/models/recommendation.py`
- dependent response models.

### Frontend tasks
1. Validate recommendation rendering/consumption paths:
- `web-ui/src/types/recommendation.ts`
- workspace and daily review views consuming recommendation payloads.

### Exit criteria
- Recommendation logic no longer top-level runtime dependency.
- API payloads unchanged.

## Phase 5: Decouple `execution` and `portfolio`
Objective: Remove cross-domain state coupling while preserving behavior.

### Backend tasks
1. Create shared state-transition primitives module, for example:
- `src/swing_screener/trade_state/` or `src/swing_screener/portfolio/transitions_shared.py`
2. Move neutral transition logic used by both domains (order fill effects, scale-in transforms).
3. Keep domain boundaries:
- `portfolio`: position state + metrics
- `execution`: order state + workflows
4. Refactor `portfolio/migrate.py` to avoid pulling deep execution internals directly.

### API tasks
1. Re-verify endpoint behavior for:
- `/api/portfolio/orders*`
- `/api/portfolio/positions*`
2. Add regression tests for fill/close/stop update flows.

### Frontend tasks
1. Re-run portfolio feature tests:
- `web-ui/src/features/portfolio/hooks.test.tsx`
- order/position type tests.
2. Validate workspace interactions (create/fill/delete orders; close position).

### Exit criteria
- No direct circular imports between `execution` and `portfolio` runtime paths.
- Portfolio/order API behavior unchanged.

## Phase 6: Data/Internal Cleanup and Performance Pass
Objective: Simplify duplicated internals and reduce hot-path overhead.

### Backend tasks
1. Apply module optimization instructions from each `OPTIMIZATION_GUIDE.md`.
2. Prioritize hot paths used by API:
- market data fetch/normalization
- screener ranking/signals vectorization
- intelligence/social caching and fetch gating
3. Keep changes incremental with perf baselines before/after.

### API tasks
1. Add benchmark-style checks for key operations in services:
- screener run latency
- portfolio summary latency
- intelligence run start/status latency

### Frontend tasks
1. Measure perceived latency on key workflows:
- workspace load
- daily review refresh
- strategy save/validate
2. Confirm no UI regressions due to field ordering or nullability drift.

### Exit criteria
- Documented latency/memory improvements.
- No contract regressions.

## Phase 7: Remove Compatibility Shims and Finalize
Objective: Complete migration and remove temporary indirection.

### Backend tasks
1. Delete deprecated module aliases/shims:
- `strategies` shim
- `screeners` shim
- `signals` shim
- top-level `recommendations` shim
2. Update docs/import examples to final paths.
3. Run import lints to ensure no stale paths remain.

### API tasks
1. Re-generate OpenAPI and compare with baseline.
2. If any changes are intentional, publish migration notes.

### Frontend tasks
1. Ensure no frontend code references deprecated backend assumptions.
2. Update developer docs in `web-ui/README.md` if needed.

### Exit criteria
- No shim imports remain.
- Final docs reflect target architecture.

## Estimated Effort and Sequencing
| Phase | Duration (engineering days) | Risk | Notes |
|---|---|---|---|
| Phase 0 | 2-3 | low | mostly test and baseline setup |
| Phase 1 | 2-4 | medium | cycle-break with compatibility wrapper |
| Phase 2 | 3-5 | medium | import-path migration with shims |
| Phase 3 | 3-5 | medium | selection merge plus screener internal rewiring |
| Phase 4 | 2-4 | medium | recommendation relocation and payload parity checks |
| Phase 5 | 4-6 | high | behavioral risk in order/position transitions |
| Phase 6 | 4-7 | medium | optimization work can be parallelized |
| Phase 7 | 1-2 | low | cleanup after all consumers moved |

Total expected effort: 21-36 engineering days, depending on test debt and conflict overhead.

## Cross-Phase Deliverables
1. Migration checklist issue per phase with owner and ETA.
2. PR template section: "Contract change?" with API/frontend impact checklist.
3. Weekly architecture report:
- completed phase tasks
- open risks
- rollback readiness

## Risks and Mitigations
1. Risk: hidden payload drift in nested recommendation/report fields.
Mitigation: response snapshot tests + frontend integration tests per phase.
2. Risk: import-path churn causes merge conflicts.
Mitigation: incremental moves with compatibility shims and short-lived branches.
3. Risk: performance regressions during structural moves.
Mitigation: baseline metrics in phase 0 and perf checks in phase 6.
4. Risk: docs drift during long migration.
Mitigation: update docs in each phase, not only at the end.

## Rollout and Branching Strategy
1. Use branch naming `codex/arch-phase-<n>-<topic>`.
2. One phase can span multiple PRs, but each PR must be deployable and backward compatible.
3. Merge order must follow phase dependencies; do not start shim-removal before all consumers migrate.

## Validation Matrix (must pass each phase)
1. Backend
- unit tests for moved modules
- architecture import checks
- service-level integration tests
2. API
- OpenAPI diff check
- endpoint regression suite
- error-code parity for major routes
3. Frontend
- feature API tests
- page integration tests (DailyReview, Workspace, Strategy)
- smoke e2e/happy path

## Suggested Execution Order (Practical)
1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7

This order breaks cycles first, then converges domains, then optimizes internals, then removes compatibility debt.
